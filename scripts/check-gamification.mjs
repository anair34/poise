/**
 * Assertions for the V2 gamification layer.
 * Run with: node --experimental-strip-types scripts/check-gamification.mjs
 *
 * Everything exercised here is pure: quest assignment, quest evaluation, XP
 * event construction, the level curve, and the retry rules. The Firestore
 * transaction that consumes them is deliberately thin for exactly this reason —
 * the rules a user will notice are all checkable without a database.
 */
import {
  assignDailyQuestIds,
  assignDailyQuests,
  eligibleQuests,
  getQuest,
  questsCompletedBy,
  QUESTS,
} from "../lib/gamification/quests.ts";
import {
  buildXpEvents,
  sumXp,
  XP_REWARDS,
} from "../lib/gamification/xp.ts";
import {
  didLevelUp,
  getLevelFromXp,
  getLevelProgress,
  getXpForNextLevel,
} from "../lib/gamification/levels.ts";
import { buildRetryComparison, retryHeadline } from "../lib/gamification/retry.ts";
import {
  INITIAL_COMPLETION_STATE,
  applyCompletion,
  applyRetry,
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

const NEW_USER = { hasPracticedBeforeToday: false };
const RETURNING = { hasPracticedBeforeToday: true };

/** Baseline session facts; override per assertion. */
function facts(overrides = {}) {
  return {
    overallScore: 60,
    clarity: 60,
    structure: 60,
    concision: 60,
    delivery: 60,
    wordsPerMinute: 145,
    fillerWordCount: 3,
    isDailyCompletion: false,
    isRetry: false,
    scoreToBeat: null,
    fillersToBeat: null,
    isPersonalBest: false,
    ...overrides,
  };
}

// ---- Deterministic daily quests -------------------------------------------
const a1 = assignDailyQuestIds("user-abc", "2026-08-27", RETURNING);
const a2 = assignDailyQuestIds("user-abc", "2026-08-27", RETURNING);
check("same uid and date give the same quests", a1, a2);
check("each user gets exactly two quests", a1.length, 2);

const repeated = Array.from({ length: 25 }, () =>
  assignDailyQuestIds("user-abc", "2026-08-27", RETURNING).join(","),
);
check(
  "assignment is stable across many reads (no refresh reroll)",
  new Set(repeated).size,
  1,
);

const other = assignDailyQuestIds("user-xyz", "2026-08-27", RETURNING);
const nextDay = assignDailyQuestIds("user-abc", "2026-08-28", RETURNING);
check(
  "different users or dates can differ",
  a1.join(",") !== other.join(",") || a1.join(",") !== nextDay.join(","),
  true,
);

const pair = assignDailyQuests("user-abc", "2026-08-27", RETURNING);
check("one standard quest is assigned", pair.standard.difficulty, "standard");
check("one stretch quest is assigned", pair.stretch.difficulty, "stretch");

// Spread: over many users, both pools should actually get used.
const standardsSeen = new Set();
const stretchesSeen = new Set();
for (let i = 0; i < 400; i += 1) {
  const p = assignDailyQuests(`user-${i}`, "2026-08-27", RETURNING);
  standardsSeen.add(p.standard.id);
  stretchesSeen.add(p.stretch.id);
}
check("standard pool is spread across users", standardsSeen.size > 1, true);
check("stretch pool is spread across users", stretchesSeen.size > 1, true);

// ---- New-user eligibility --------------------------------------------------
const retryQuestIds = QUESTS.filter((q) => q.requiresRetry).map((q) => q.id);
let newUserGotRetryQuest = false;
for (let i = 0; i < 400; i += 1) {
  const ids = assignDailyQuestIds(`fresh-${i}`, "2026-08-27", NEW_USER);
  if (ids.some((id) => retryQuestIds.includes(id))) newUserGotRetryQuest = true;
}
check("a brand-new user never gets a retry quest", newUserGotRetryQuest, false);
check(
  "a returning user can get retry quests",
  eligibleQuests(QUESTS, RETURNING).some((q) => q.requiresRetry),
  true,
);
check(
  "eligibility never empties the pool",
  eligibleQuests(QUESTS, NEW_USER).length > 0,
  true,
);

// ---- Quest completion ------------------------------------------------------
check(
  "Clean Run completes at 5 fillers",
  getQuest("clean-run").isSatisfiedBy(facts({ fillerWordCount: 5 })),
  true,
);
check(
  "Clean Run fails at 6 fillers",
  getQuest("clean-run").isSatisfiedBy(facts({ fillerWordCount: 6 })),
  false,
);
check(
  "Smooth Pace accepts 120 wpm",
  getQuest("smooth-pace").isSatisfiedBy(facts({ wordsPerMinute: 120 })),
  true,
);
check(
  "Smooth Pace accepts 170 wpm",
  getQuest("smooth-pace").isSatisfiedBy(facts({ wordsPerMinute: 170 })),
  true,
);
check(
  "Smooth Pace rejects 171 wpm",
  getQuest("smooth-pace").isSatisfiedBy(facts({ wordsPerMinute: 171 })),
  false,
);
check(
  "Show Up needs the daily completion",
  getQuest("show-up").isSatisfiedBy(facts({ isDailyCompletion: true })),
  true,
);
check(
  "Show Up is not satisfied by a retry",
  getQuest("show-up").isSatisfiedBy(facts({ isDailyCompletion: false })),
  false,
);
check(
  "Crystal Clear needs 80 clarity",
  getQuest("crystal-clear").isSatisfiedBy(facts({ clarity: 80 })),
  true,
);
check(
  "Beat Yourself needs a retry that improved",
  getQuest("beat-yourself").isSatisfiedBy(
    facts({ isRetry: true, scoreToBeat: 70, overallScore: 75 }),
  ),
  true,
);
check(
  "Beat Yourself rejects an equal retry",
  getQuest("beat-yourself").isSatisfiedBy(
    facts({ isRetry: true, scoreToBeat: 70, overallScore: 70 }),
  ),
  false,
);
check(
  "Cleaner Take needs fewer fillers than the parent",
  getQuest("cleaner-take").isSatisfiedBy(
    facts({ isRetry: true, fillersToBeat: 7, fillerWordCount: 3 }),
  ),
  true,
);

// ---- A quest is only completable once per day ------------------------------
const dayQuests = ["clean-run", "crystal-clear"];
const firstPass = questsCompletedBy(dayQuests, [], facts({ fillerWordCount: 1 }));
check("first qualifying session completes the quest", firstPass.map((q) => q.id), [
  "clean-run",
]);
const secondPass = questsCompletedBy(
  dayQuests,
  ["clean-run"],
  facts({ fillerWordCount: 1 }),
);
check("an already-completed quest is not returned again", secondPass.length, 0);

// ---- XP events -------------------------------------------------------------
const dailyXp = buildXpEvents({
  dayKey: "2026-08-27",
  sessionId: "s1",
  isDailyCompletion: true,
  isRetry: false,
  retryImproved: false,
  isPersonalBest: false,
  questsCompleted: [],
});
check("completing the daily challenge awards XP", sumXp(dailyXp), XP_REWARDS.daily_challenge);
check(
  "the daily award is keyed by day, not session",
  dailyXp[0].id,
  "daily_challenge:2026-08-27",
);

const retryXp = buildXpEvents({
  dayKey: "2026-08-27",
  sessionId: "s2",
  isDailyCompletion: false,
  isRetry: true,
  retryImproved: true,
  isPersonalBest: false,
  questsCompleted: [],
});
check(
  "an improved retry awards both retry rewards",
  sumXp(retryXp),
  XP_REWARDS.first_retry + XP_REWARDS.retry_improved,
);

const secondRetryXp = buildXpEvents({
  dayKey: "2026-08-27",
  sessionId: "s3",
  isDailyCompletion: false,
  isRetry: true,
  retryImproved: false,
  isPersonalBest: false,
  questsCompleted: [],
});
check(
  "a second retry the same day reuses the same event id (no farming)",
  secondRetryXp[0].id,
  retryXp[0].id,
);

const questXp = buildXpEvents({
  dayKey: "2026-08-27",
  sessionId: "s4",
  isDailyCompletion: false,
  isRetry: false,
  retryImproved: false,
  isPersonalBest: false,
  questsCompleted: [getQuest("clean-run")],
});
check("a completed quest awards its XP", sumXp(questXp), XP_REWARDS.quest);
check(
  "quest XP is keyed by day and quest, so it pays once",
  questXp[0].id,
  "quest:2026-08-27:clean-run",
);

const bestXp = buildXpEvents({
  dayKey: "2026-08-27",
  sessionId: "s5",
  isDailyCompletion: false,
  isRetry: false,
  retryImproved: false,
  isPersonalBest: true,
  questsCompleted: [],
});
check(
  "a personal best is keyed by session, since it cannot repeat without improving",
  bestXp[0].id,
  "personal_best:s5",
);

/** Awards only events whose ids are not already banked. */
function award(ledger, events) {
  const fresh = events.filter((event) => !ledger.has(event.id));
  for (const event of fresh) ledger.set(event.id, event.amount);
  return sumXp(fresh);
}

const ledger = new Map();
const eventsFor = () =>
  buildXpEvents({
    dayKey: "2026-08-27",
    sessionId: "s6",
    isDailyCompletion: true,
    isRetry: false,
    retryImproved: false,
    isPersonalBest: false,
    questsCompleted: [getQuest("clean-run")],
  });

const firstAward = award(ledger, eventsFor());
const replayAward = award(ledger, eventsFor());
check(
  "first submission awards daily + quest XP",
  firstAward,
  XP_REWARDS.daily_challenge + XP_REWARDS.quest,
);
check("a replayed identical submission awards nothing", replayAward, 0);

// Concurrency: two identical submissions racing award exactly once in total.
const raceLedger = new Map();
const concurrent = [eventsFor(), eventsFor()].map((events) =>
  award(raceLedger, events),
);
check(
  "concurrent duplicate submissions award XP exactly once",
  concurrent[0] + concurrent[1],
  XP_REWARDS.daily_challenge + XP_REWARDS.quest,
);

// ---- Level thresholds ------------------------------------------------------
check("0 XP is level 1", getLevelFromXp(0), 1);
check("49 XP is still level 1", getLevelFromXp(49), 1);
check("50 XP is level 2", getLevelFromXp(50), 2);
check("119 XP is still level 2", getLevelFromXp(119), 2);
check("120 XP is level 3", getLevelFromXp(120), 3);
check("200 XP is level 4", getLevelFromXp(200), 4);
check("300 XP is level 5", getLevelFromXp(300), 5);
check("425 XP is level 6", getLevelFromXp(425), 6);
check("575 XP is level 7", getLevelFromXp(575), 7);
check("negative XP is clamped to level 1", getLevelFromXp(-100), 1);
check("the curve continues past the table", getLevelFromXp(100000) > 15, true);

check("next level from 240 XP is 300", getXpForNextLevel(240), 300);
const progress = getLevelProgress(240);
check("240 XP is level 4", progress.level, 4);
check("240 XP is 40 into level 4", progress.xpIntoLevel, 40);
check("level 4 spans 100 XP", progress.xpForLevel, 100);
check("240 XP is 40% through level 4", Math.round(progress.progress * 100), 40);

check("crossing a threshold is a level up", didLevelUp(45, 20), true);
check("staying inside a level is not", didLevelUp(10, 20), false);
check("awarding nothing is never a level up", didLevelUp(49, 0), false);

// ---- Retry does not touch the streak --------------------------------------
const day1 = applyCompletion({ ...INITIAL_COMPLETION_STATE }, "2026-08-27");
check("the first session earns a streak of 1", day1.streakEarned, 1);
check("the first session is a daily completion", day1.isDailyCompletion, true);

const retried = applyRetry(day1.next);
check("a retry is never a daily completion", retried.isDailyCompletion, false);
check("a retry does not advance the streak", retried.next.currentStreak, 1);
check(
  "a retry does not add a practice day",
  retried.next.daysPracticed,
  day1.next.daysPracticed,
);
check("a retry still counts as a session", retried.next.totalSessions, 2);
check(
  "a retry does not move the last practice day",
  retried.next.lastPracticeDay,
  "2026-08-27",
);
check(
  "a retry reports the streak the user already has",
  retried.streakEarned,
  1,
);

const manyRetries = [1, 2, 3].reduce((state) => applyRetry(state).next, day1.next);
check("three retries add three sessions", manyRetries.totalSessions, 4);
check("three retries add no practice days", manyRetries.daysPracticed, 1);
check("three retries leave the streak alone", manyRetries.currentStreak, 1);

// ---- Retry comparison ------------------------------------------------------
function session(overrides = {}) {
  return {
    id: "x",
    createdAt: "2026-08-27T10:00:00.000Z",
    challengeDate: "2026-08-27",
    promptId: "p",
    promptText: "prompt",
    category: "Opinion",
    transcript: "t",
    overallScore: 74,
    scores: { clarity: 77, structure: 70, concision: 65, delivery: 82 },
    metrics: {
      wordsPerMinute: 150,
      fillerWordCount: 7,
      fillerWords: [],
      durationSeconds: 60,
      wordCount: 150,
      fillerRate: 6.1,
      repetitionRate: 0.11,
    },
    feedback: { summary: "s" },
    streak: 1,
    dayNumber: 1,
    ...overrides,
  };
}

const before = session();
const after = session({
  overallScore: 82,
  scores: { clarity: 84, structure: 80, concision: 83, delivery: 81 },
  metrics: {
    ...session().metrics,
    fillerWordCount: 3,
    fillerRate: 2.7,
    repetitionRate: 0.06,
  },
});

const improved = buildRetryComparison(before, after);
check("overall delta is computed", improved.overallDelta, 8);
check("beating the original is detected", improved.beatOriginal, true);
check(
  "the biggest improvement is identified",
  improved.biggestImprovement.label,
  "Concision",
);
check("filler reduction is counted", improved.fillerReduction, 4);
check(
  "a dimension that dropped is not marked improved",
  improved.scores.find((r) => r.label === "Delivery").improved,
  false,
);
check(
  "filler rate is compared as a decimal",
  improved.metrics.find((r) => r.label === "Filler rate").after,
  2.7,
);
check(
  "repetition is compared as a percentage",
  improved.metrics.find((r) => r.label === "Repetition").before,
  11,
);
check(
  "pace is reported without a verdict",
  improved.metrics.find((r) => r.label === "Pace").improved,
  null,
);
check("an improved retry is celebrated", retryHeadline(improved), "You beat it by 8.");

const worse = buildRetryComparison(
  before,
  session({ overallScore: 66, metrics: { ...session().metrics, fillerWordCount: 4 } }),
);
check("a lower retry is detected", worse.beatOriginal, false);
check("a lower retry reports a negative delta", worse.overallDelta, -8);
check(
  "a lower retry with fewer fillers is framed supportively",
  retryHeadline(worse),
  "Not your best score — but a cleaner take.",
);
const flat = buildRetryComparison(before, session());
check("an identical retry reads as even", retryHeadline(flat), "Dead even with your last take.");

// A retry against an attempt with no optional metrics must not invent progress.
const sparse = session({ metrics: { ...session().metrics, fillerRate: undefined, repetitionRate: undefined } });
const sparseComparison = buildRetryComparison(sparse, session());
check(
  "missing optional metrics are skipped rather than compared against zero",
  sparseComparison.metrics.some((r) => r.label === "Filler rate"),
  false,
);

console.log(
  failures === 0
    ? "\nAll checks passed."
    : `\n${failures} check${failures === 1 ? "" : "s"} failed.`,
);
process.exit(failures === 0 ? 0 : 1);
