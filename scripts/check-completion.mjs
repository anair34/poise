/**
 * Assertions for the daily-completion model.
 * Run with: node --experimental-strip-types scripts/check-completion.mjs
 *
 * `applyCompletion` decides three things a user will notice immediately if they
 * are wrong: whether today counted, what streak a session earned, and how the
 * two totals move. It is pure, so all of that is checked here without Firestore.
 */
import {
  INITIAL_COMPLETION_STATE,
  applyCompletion,
} from "../lib/streaks.ts";

let failures = 0;

function check(label, actual, expected) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) failures += 1;
  console.log(
    `${pass ? "PASS" : "FAIL"}  ${label}` +
      (pass
        ? ""
        : `\n        expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`),
  );
}

/** Applies a run of day keys in order, returning every step. */
function playback(days, state = { ...INITIAL_COMPLETION_STATE }) {
  const steps = [];
  let current = state;
  for (const day of days) {
    const completion = applyCompletion(current, day);
    steps.push(completion);
    current = completion.next;
  }
  return { steps, final: current };
}

// ---- New user, first completion -------------------------------------------
const first = applyCompletion({ ...INITIAL_COMPLETION_STATE }, "2026-08-27");
check("first ever completion counts as a daily completion", first.isDailyCompletion, true);
check("first ever session earns a streak of 1", first.streakEarned, 1);
check("first completion sets the practice day", first.next.lastPracticeDay, "2026-08-27");
check("first completion counts one session", first.next.totalSessions, 1);
check("first completion counts one practice day", first.next.daysPracticed, 1);
check("first completion sets longest to 1", first.next.longestStreak, 1);

// ---- Same-day retry --------------------------------------------------------
const retry = applyCompletion(first.next, "2026-08-27");
check("a same-day retry is not a daily completion", retry.isDailyCompletion, false);
check("a same-day retry earns the streak already held", retry.streakEarned, 1);
check("a same-day retry does not extend the streak", retry.next.currentStreak, 1);
check("a same-day retry still counts as a session", retry.next.totalSessions, 2);
check("a same-day retry does not add a practice day", retry.next.daysPracticed, 1);

// ---- Next-day completion ---------------------------------------------------
const nextDay = applyCompletion(retry.next, "2026-08-28");
check("the next day is a daily completion", nextDay.isDailyCompletion, true);
check("the next day earns a streak of 2", nextDay.streakEarned, 2);
check("the next day is the third session", nextDay.next.totalSessions, 3);
check("the next day is the second practice day", nextDay.next.daysPracticed, 2);

// The example from the spec, start to finish.
const spec = playback(["2026-08-27", "2026-08-28", "2026-08-28"]);
check(
  "spec example: first=1, next day=2, same-day retry=2",
  spec.steps.map((step) => step.streakEarned),
  [1, 2, 2],
);

// ---- Missed day ------------------------------------------------------------
const missed = playback(["2026-08-27", "2026-08-28", "2026-08-30"]);
check(
  "a missed day resets the earned streak to 1",
  missed.steps.at(-1).streakEarned,
  1,
);
check("a missed day still counts as a completion", missed.steps.at(-1).isDailyCompletion, true);
check("a reset is reported", missed.steps.at(-1).didReset, true);
check("three sessions survive the reset", missed.final.totalSessions, 3);
check("three practice days survive the reset", missed.final.daysPracticed, 3);

// ---- Longest streak --------------------------------------------------------
const week = playback([
  "2026-08-01",
  "2026-08-02",
  "2026-08-03",
  "2026-08-04",
  // Gap: the 5th is missed.
  "2026-08-06",
]);
check("current streak falls back to 1 after the gap", week.final.currentStreak, 1);
check("longest streak remembers the best run", week.final.longestStreak, 4);
check(
  "the streak each session earned is preserved in order",
  week.steps.map((step) => step.streakEarned),
  [1, 2, 3, 4, 1],
);

// ---- totalSessions vs totalPracticeDays ------------------------------------
const busy = playback([
  "2026-08-01",
  "2026-08-01",
  "2026-08-01",
  "2026-08-02",
]);
check("four attempts count as four sessions", busy.final.totalSessions, 4);
check("four attempts over two dates count as two practice days", busy.final.daysPracticed, 2);
check(
  "only the first session of each date is a daily completion",
  busy.steps.map((step) => step.isDailyCompletion),
  [true, false, false, true],
);

// ---- Concurrent submission protection --------------------------------------
// Two requests landing together both read the same state. The transaction makes
// the loser retry against the winner's write, which is this sequence — so the
// second must be classified as a retry and must not advance the streak.
const shared = { ...INITIAL_COMPLETION_STATE };
const winner = applyCompletion(shared, "2026-08-27");
const loserRetried = applyCompletion(winner.next, "2026-08-27");
check("concurrent: only one submission is a daily completion", [
  winner.isDailyCompletion,
  loserRetried.isDailyCompletion,
], [true, false]);
check("concurrent: the streak advances exactly once", loserRetried.next.currentStreak, 1);
check("concurrent: both attempts are counted as sessions", loserRetried.next.totalSessions, 2);
check("concurrent: only one practice day is recorded", loserRetried.next.daysPracticed, 1);

// The failure mode being prevented, stated explicitly: applied to the same
// stale state, both submissions produce totalSessions=1, so the last write wins
// and one session is silently lost. The transaction is what turns this into the
// sequence above.
const loserStale = applyCompletion(shared, "2026-08-27");
check(
  "concurrent: stale state would lose a session (1, not 2)",
  [loserStale.next.totalSessions, loserRetried.next.totalSessions],
  [1, 2],
);

// ---- Historical accuracy ---------------------------------------------------
// A session stores the streak it earned. Later sessions must not change it.
const history = playback([
  "2026-08-27",
  "2026-08-28",
  "2026-08-29",
  "2026-09-05",
]);
check(
  "an old session keeps the streak it earned after a later reset",
  history.steps.map((step) => step.streakEarned),
  [1, 2, 3, 1],
);
check(
  "the reset does not rewrite the peak the third session earned",
  history.steps[2].streakEarned,
  3,
);

// ---- Backdated and replayed sessions ---------------------------------------
const backdated = applyCompletion(history.final, "2026-08-01");
check("a backdated session is not a daily completion", backdated.isDailyCompletion, false);
check(
  "a backdated session cannot rewrite the last practice day",
  backdated.next.lastPracticeDay,
  "2026-09-05",
);
check("a backdated session still counts as a session", backdated.next.totalSessions, 5);
check(
  "a backdated session does not add a practice day",
  backdated.next.daysPracticed,
  history.final.daysPracticed,
);

console.log(
  failures === 0
    ? "\nAll checks passed."
    : `\n${failures} check${failures === 1 ? "" : "s"} failed.`,
);
process.exit(failures === 0 ? 0 : 1);
