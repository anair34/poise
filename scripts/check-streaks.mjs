/**
 * Assertions for day keys and streak arithmetic.
 * Run with: node --experimental-strip-types scripts/check-streaks.mjs
 *
 * These rules are easy to get subtly wrong and expensive to get wrong in public
 * — a streak that resets when it shouldn't is the fastest way to lose a user who
 * was doing everything right.
 */
import {
  INITIAL_STREAK_STATE,
  applyPractice,
  daysBetween,
  fromDayKey,
  hasPracticedToday,
  isValidDayKey,
  shiftDayKey,
  toDayKey,
  visibleStreak,
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

// ---- Day keys ------------------------------------------------------------
check("formats a day key", toDayKey(new Date("2026-08-27T15:48:00Z")), "2026-08-27");
check(
  "late UTC evening stays on the same day",
  toDayKey(new Date("2026-08-27T23:59:59Z")),
  "2026-08-27",
);
check(
  "just after midnight is the next day",
  toDayKey(new Date("2026-08-28T00:00:01Z")),
  "2026-08-28",
);
check("round-trips through fromDayKey", toDayKey(fromDayKey("2026-08-27")), "2026-08-27");

check("accepts a well-formed key", isValidDayKey("2026-08-27"), true);
check("rejects a nonexistent date", isValidDayKey("2026-02-30"), false);
check("rejects a malformed key", isValidDayKey("2026-8-27"), false);
check("rejects a non-string", isValidDayKey(20260827), false);

check("shifts forward", shiftDayKey("2026-08-27", 1), "2026-08-28");
check("shifts backward", shiftDayKey("2026-08-27", -1), "2026-08-26");
check("shifts across a month boundary", shiftDayKey("2026-08-31", 1), "2026-09-01");
check("shifts across a year boundary", shiftDayKey("2026-12-31", 1), "2027-01-01");
check("handles a leap day", shiftDayKey("2028-02-28", 1), "2028-02-29");

check("counts days between", daysBetween("2026-08-27", "2026-08-30"), 3);
check("is negative going backwards", daysBetween("2026-08-30", "2026-08-27"), -3);
check("is zero for the same day", daysBetween("2026-08-27", "2026-08-27"), 0);

// ---- Building a streak ---------------------------------------------------
const day1 = applyPractice(INITIAL_STREAK_STATE, "2026-08-27");
check("first ever session starts a streak of 1", day1.currentStreak, 1);
check("first session counts as a new day", day1.isNewDay, true);
check("first session is day 1", day1.daysPracticed, 1);

const day2 = applyPractice(day1, "2026-08-28");
check("consecutive day extends the streak", day2.currentStreak, 2);
check("longest keeps up with current", day2.longestStreak, 2);

const day3 = applyPractice(day2, "2026-08-29");
check("streak keeps building", day3.currentStreak, 3);

// ---- Practising twice in one day ----------------------------------------
const again = applyPractice(day3, "2026-08-29");
check("a second session the same day does not extend", again.currentStreak, 3);
check("a second session is not a new day", again.isNewDay, false);
check("a second session does not inflate days practiced", again.daysPracticed, 3);

// ---- Missing a day ------------------------------------------------------
const afterGap = applyPractice(day3, "2026-08-31");
check("a skipped day resets to 1", afterGap.currentStreak, 1);
check("a reset is reported", afterGap.didReset, true);
check("longest streak is preserved through a reset", afterGap.longestStreak, 3);
check("days practiced still accumulates", afterGap.daysPracticed, 4);

// A backdated or replayed session must not rewrite history.
const backwards = applyPractice(day3, "2026-08-20");
check("an out-of-order past day is ignored", backwards.currentStreak, 3);
check("an out-of-order past day is not a new day", backwards.isNewDay, false);
check("last practice day is unchanged", backwards.lastPracticeDay, "2026-08-29");

// ---- What the user actually sees ----------------------------------------
// Stored state only changes when someone practices, so display has to decide
// whether a stale streak is still alive.
check(
  "streak shows in full on the day it was earned",
  visibleStreak(day3, "2026-08-29"),
  3,
);
check(
  "streak survives until the end of the next day",
  visibleStreak(day3, "2026-08-30"),
  3,
);
check(
  "streak is gone once a full day was missed",
  visibleStreak(day3, "2026-08-31"),
  0,
);
check("a brand new user has no streak", visibleStreak(INITIAL_STREAK_STATE), 0);

check("knows today is done", hasPracticedToday(day3, "2026-08-29"), true);
check("knows today is not done", hasPracticedToday(day3, "2026-08-30"), false);

// ---- A realistic month --------------------------------------------------
// Practice every day for a week, miss one, then rebuild.
let state = INITIAL_STREAK_STATE;
for (let i = 0; i < 7; i += 1) {
  state = applyPractice(state, shiftDayKey("2026-09-01", i));
}
check("a full week builds a streak of 7", state.currentStreak, 7);

state = applyPractice(state, shiftDayKey("2026-09-01", 8));
check("one missed day resets the streak", state.currentStreak, 1);
check("the best week is remembered", state.longestStreak, 7);
check("total days practiced is 8", state.daysPracticed, 8);

console.log(
  failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`,
);
process.exit(failures === 0 ? 0 : 1);
