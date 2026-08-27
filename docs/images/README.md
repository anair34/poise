# Screenshots

Screenshots referenced by the root `README.md`.

| File | Screen | Used in |
| --- | --- | --- |
| `landing.png` | `/` | Demo hero |
| `signin.png` | `/signin` | Demo grid 1 |
| `signup.png` | `/signup` | Demo grid 1 |
| `practice.png` | `/practice` | Demo grid 1 |
| `recording.png` | `/practice`, mid-recording | Demo grid 2 |
| `quests.png` | `/conversations`, quest card | Demo grid 2 |
| `progress.png` | `/conversations` | Demo grid 2 |
| `results.png` | `/results/[id]` | Walkthrough, step 4 |
| `beat-your-score.png` | `/results/[id]` on a retry | Walkthrough, step 6 |
| `calendar.png` | `/conversations`, calendar card | Walkthrough, step 7 |

## Recapturing

The authenticated screens need a signed-in user with practice history. These
were captured against the Firebase emulators rather than a live project, so the
account is local and disposable:

```bash
firebase emulators:start --only firestore,auth
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
POISE_SCORING_MODE=mock npm run dev
```

Then seed a user with a streak, XP, and a retry pair, sign in to get a session
cookie, and drive a headless browser over the routes above. Captures were taken
at 1440 wide with a device scale factor of 2.
