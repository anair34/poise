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

`firestore.indexes.json` holds the composite indexes for the `userId` +
`createdAt` history queries, which Firestore cannot serve from automatic
single-field indexes.

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

For UI work without API credit, set `POISE_SCORING_MODE=mock`.

For persistence without a real Firebase project, run the Firestore emulator:

```bash
npx firebase-tools emulators:start --only firestore --project poise-dev
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_PROJECT_ID=poise-dev npm run dev
```

## Checks

```bash
npm run check          # scoring + streak assertions
npm run check:streaks  # day keys and streak arithmetic only
npx tsc --noEmit       # typecheck
npm run build          # production build
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
