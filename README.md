# Poise

A daily AI speaking coach. One prompt a day, one minute of speech, structured
feedback on how you communicated.

## Architecture

Three pieces, each with one job:

| Layer | Responsibility |
| --- | --- |
| **Next.js** | Product, UI, and API orchestration (App Router, TypeScript, Tailwind) |
| **OpenAI** | Transcription, structured rubric scoring and coaching, daily prompt generation |
| **Firebase** | Auth (Google + email/password) and persistence (Firestore) |

There is no custom ML service. An earlier iteration trained a Python model to
predict the scores; it was removed because the labels available to train it were
themselves LLM-generated, so the model could only imitate the thing it was meant
to replace — at the cost of a second runtime to deploy and keep in sync.

### Scoring pipeline

```
recorded audio
  -> OpenAI transcription
  -> deterministic transcript metrics        (lib/scoring.ts)
  -> OpenAI structured rubric scoring        (lib/openai.ts)
  -> deterministic overall score             (lib/scoring.ts)
  -> coaching feedback
  -> Firestore                               (lib/sessions.ts)
  -> results page
```

The model rates four dimensions — clarity, structure, concision, delivery — as
integers from 0 to 100. **It never returns the overall score.** That is computed
by the app:

```
overall = clarity×0.30 + structure×0.25 + concision×0.25 + delivery×0.20
```

Keeping the weighting in code means the number is reproducible, and any change
in it always traces back to a dimension.

### Deterministic metrics

`lib/scoring.ts` measures the transcript before the model sees it: words per
minute, filler count and rate, hedge count and rate, repeated-phrase rate, and
lexical diversity. These go to the model as evidence and to the user as fact.
Same recording, same numbers, every time.

The model is told it has only the transcript, the duration, and these metrics —
so it must not claim to judge tone, emotion, charisma, eye contact, or body
language, none of which are observable from a transcript.

## Accounts and streaks

Sign-in is Google or email/password, via Firebase Auth. The browser holds the
Firebase session; the server needs one too, so the ID token is exchanged once at
`/api/auth/session` for an **httpOnly session cookie**. That cookie is what makes
`/results` and `/progress` safe to render on the server.

`proxy.ts` redirects visitors with no cookie away from private routes, but it is
not the security boundary — the edge runtime cannot run firebase-admin, so it can
only check that a cookie *exists*. Verification happens in `getCurrentUser()`,
and every protected page and route calls it. Session reads are owner-scoped in
`lib/sessions.ts`, so a shared results link reveals nothing.

The uid always comes from a verified credential. No route reads a user id from a
body, query string, or header — `/api/analyze` derives it from the session cookie
before it spends anything, and `/api/auth/session` takes an ID token rather than a
uid, because a uid is a claim and a token is proof.

### The session cookie

| Property | Value | Why |
| --- | --- | --- |
| `httpOnly` | always | JavaScript cannot read it, so an XSS bug cannot exfiltrate a session |
| `secure` | production, and any https request | no plaintext transmission where TLS exists |
| `sameSite` | `lax` | survives a top-level return from the Google popup; not sent on cross-site POSTs |
| `maxAge` | 14 days | Firebase's maximum for a session cookie |
| `path` | `/` | one session for the whole app |

Sign-out clears the client SDK first, then deletes the cookie and revokes the
account's refresh tokens, so a copy of the cookie taken beforehand cannot be
replayed. An expired or tampered cookie fails closed: `getCurrentUser()` returns
null and the page redirects to `/signin`.

The browser can outlive its cookie — the SDK's refresh token lasts far longer
than fourteen days — so `AuthProvider` mints a fresh cookie when it finds a live
Firebase session and no server session, rather than making the user sign in again
for no visible reason.

### `users/{uid}`

Created on first sign-in and updated transactionally thereafter. All timestamps
are `serverTimestamp()`, never a client or process clock.

| Field | Written |
| --- | --- |
| `uid`, `email`, `displayName`, `photoURL` | every sign-in |
| `createdAt` | once, at creation |
| `lastSeenAt`, `updatedAt` | every sign-in |
| `currentStreak`, `longestStreak` | each completed session |
| `firstPracticeDate` | once, at first completed session |
| `lastPracticeDate`, `lastPracticeDay`, `lastCompletedChallengeDate` | each completed session |
| `totalSessions`, `totalPracticeDays`, `lastOverallScore` | each completed session |

Sign-in writes the profile fields only. Because every write merges and
`createdAt` is absent from the sign-in payload, a returning user's gamification
state cannot be reset by signing in.

**`totalSessions` and `totalPracticeDays` are not the same number** and must
never be conflated: three sessions in one day is `totalSessions: 3` and
`totalPracticeDays: 1`. Conflating them makes an enthusiastic user look like a
long-running one, which is the one number a streak product has to get right.

## Daily completion

A challenge counts as completed only when an authenticated user submits a valid
recording, transcription succeeds, scoring succeeds, **and** the session persists.
Starting or recording counts for nothing.

Each `practiceSessions/{id}` records how it landed:

| Field | Meaning |
| --- | --- |
| `userId` | owner, always from the verified session cookie |
| `challengeDate` | the UTC day this counted toward |
| `challengeId` | which challenge slot it filled, `daily-{challengeDate}` |
| `promptId` | the prompt actually answered — differs on a retry of an older prompt |
| `isDailyCompletion` | true only for the first successful session that date |
| `streakEarned` | the streak this session earned, frozen at write time |

`streakEarned` is stored rather than derived so an old results page keeps showing
the streak the user actually had that day. Deriving it later would let a missed
day silently rewrite history.

`lib/streaks.ts` holds the whole rule set as `applyCompletion`, a pure function,
so every case is verifiable without Firestore — see `npm run check:completion`.

### One transaction

The session write and the aggregate update happen in a single Firestore
transaction. They used to be sequential, which had a real failure mode: a streak
could advance for a session that then failed to save, leaving a user with a
streak and nothing behind it.

The transaction is also what makes concurrent submissions safe. Two requests
landing together would otherwise both read the same starting streak and write
back the same value, losing a day and making the outcome depend on timing.
Firestore aborts the loser and retries it against the winner's write, so the
second submission is correctly classified as a same-day retry.

### Query helpers

All Firestore access lives in `lib/`. No UI component issues a query.

```
getUserSessions(uid, max)                        newest first
getRecentUserSessions(uid, limit)                the progress page
getUserSessionsForDateRange(uid, start, end)     inclusive, by challengeDate
hasCompletedChallengeOnDate(uid, dateKey)        existence only, limit(1)
getUserGamification(uid)                         one document read
getSessionForUser(id, uid)                       owner-scoped, null if not yours
```

### What a "day" is

One UTC calendar date, `YYYY-MM-DD`, in `lib/streaks.ts`. This is deliberately
the same unit as the prompt of the day: **when the prompt changes, the day
changes**, for everyone at once. Per-user local midnights were the alternative,
and they let a user's streak disagree with their own daily prompt about what day
it is.

Streak rules, all in pure functions and covered by `npm run check:streaks`:

- Practicing twice in one day does not extend a streak.
- A backdated or replayed session cannot rewrite history.
- A stored streak is only *displayed* if the last session was today or yesterday
  — yesterday still counts, because today is not over.
- `longestStreak` survives a reset.

Counters live on `users/{uid}` and are updated in a Firestore transaction, so two
submissions landing together cannot both read the same starting streak.

## Daily prompts

A Vercel Cron job hits `/api/cron/daily-prompt` nightly and writes prompts for
today and tomorrow into `dailyPrompts/{dayKey}`. Generating a day ahead means a
single failed run never reaches users.

Three properties matter here:

- **Idempotent.** Writes are create-if-absent inside a transaction, so a retry,
  a backfill, and two concurrent requests all converge on one prompt per day. A
  user must never see the challenge change mid-session.
- **Deduplicated.** Recent prompt texts are passed to the model as things to
  avoid, or it converges on rephrasing the same few questions.
- **Never blocking.** The request path never calls the model. If generation
  hasn't run, the deterministic library prompt is stored for that day instead, so
  a cron outage costs a repeat rather than a broken page.

Generate locally against a running dev server:

```bash
npm run prompt:today                          # today and tomorrow
npm run prompt:today -- --day 2026-09-01      # one specific date
```

## Firestore rules and indexes

`firestore.rules` denies all client writes. Every write in the app goes through
the Admin SDK, which bypasses rules entirely, so granting write access would only
open a path for a browser to forge a score or inflate a streak. Reads are
owner-scoped.

`firestore.indexes.json` holds two composite indexes, one per query shape that
Firestore cannot serve from automatic single-field indexes:

| Index | Serves |
| --- | --- |
| `userId` ASC + `createdAt` DESC | `getUserSessions`, `getRecentUserSessions` |
| `userId` ASC + `challengeDate` ASC | `getUserSessionsForDateRange`, `hasCompletedChallengeOnDate` |

Nothing else is indexed. An index that no query uses still costs a write on
every session.

```bash
npx firebase-tools deploy --only firestore:rules,firestore:indexes
```

## Scoring modes

`POISE_SCORING_MODE` selects how sessions are scored. Default `llm`.

| Mode | Behavior |
| --- | --- |
| `llm` | Real transcription and real structured scoring. Production. |
| `mock` | No external API calls. Local UI and demo work. |

`mock` is an explicit opt-in and never a fallback. Silently degrading to canned
scores would show a user fabricated feedback about a real recording; a failed
analysis returns an error instead.

## Local development

```bash
npm install
cp .env.example .env.local     # add your OpenAI key and Firebase credentials
npm run dev
```

### Firebase console setup

Code alone won't sign anyone in. In the [Firebase console](https://console.firebase.google.com):

1. **Authentication → Sign-in method** — enable **Google** and **Email/Password**.
   A disabled provider surfaces as `auth/operation-not-allowed`, which reads like
   a code bug but isn't one.
2. **Authentication → Settings → Authorized domains** — add every host you sign in
   from. `localhost` is there by default; your Vercel production and preview
   domains are not. A missing domain surfaces as `auth/unauthorized-domain`.
3. **Project settings → General → Your apps** — register a Web app and copy its
   config into the `NEXT_PUBLIC_FIREBASE_*` variables.
4. **Project settings → Service accounts → Generate new private key** — the
   downloaded JSON supplies `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and
   `FIREBASE_PRIVATE_KEY`. Never commit it.
5. Deploy the rules and indexes (see below), or every Firestore read fails.

Google sign-in uses a popup rather than a redirect, deliberately: the recorder
holds an unsaved recording in memory, and a full-page redirect would discard it.

For UI work without API credit, set `POISE_SCORING_MODE=mock`.

For persistence without a real Firebase project, run the Firestore emulator:

```bash
npx firebase-tools emulators:start --only firestore --project poise-dev
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_PROJECT_ID=poise-dev npm run dev
```

## Checks

```bash
npm run check             # scoring + streak + completion assertions
npm run check:streaks     # day keys and streak arithmetic only
npm run check:completion  # daily completion, retries, concurrency
npx tsc --noEmit          # typecheck
npm run build             # production build
```

## Layout

```
app/
  page.tsx            landing page — statically rendered, reads no session
  (app)/              signed-in surface: /practice, /progress, /results/[id],
                      /signin, /signup, /reset-password
  api/analyze         the scoring pipeline
  api/auth/session    ID token -> session cookie exchange
  api/cron            scheduled prompt generation
proxy.ts              redirects signed-out visitors off private routes
components/
  auth/               card, forms, Google button, account menu
  marketing/ practice/ results/ ui/
lib/
  auth/               session cookie, error copy, redirect guard
  openai.ts           transcription, scoring and coaching, prompt generation
  scoring.ts          deterministic metrics and the overall-score weighting
  streaks.ts          day keys and streak arithmetic (pure)
  users.ts            users/{uid}: profile, streak, transactional updates
  dailyPrompts.ts     dailyPrompts/{dayKey}: generation, dedupe, fallback
  sessions.ts         Firestore repository, owner-scoped reads
  firebase/           admin.ts (server) and client.ts (browser auth)
scripts/              standalone assertions run via npm run check
```

Auth routes live in the `(app)` route group so the root layout stays free of
`cookies()`. Reading the session there would opt the landing page into dynamic
rendering. Route groups don't affect URLs.
