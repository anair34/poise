/**
 * The daily quest registry and the rules for handing quests out.
 *
 * Everything here is pure. Quest *evaluation* runs on the server against
 * persisted session data (see `lib/gamification/dailyQuests.ts`); nothing in
 * this file reads Firestore, so every rule below is testable in isolation and
 * the browser can never be the thing that decides a quest was completed.
 */

export type QuestDifficulty = "standard" | "stretch";

export type QuestCategory =
  | "delivery"
  | "consistency"
  | "clarity"
  | "improvement";

/** XP is per-difficulty rather than per-quest, so the set stays balanced. */
export const QUEST_XP: Record<QuestDifficulty, number> = {
  standard: 15,
  stretch: 15,
};

/**
 * Facts about one completed session, as the quest rules see them.
 *
 * Deliberately a flat record of already-decided values rather than the session
 * document: a quest rule should never be in a position to re-derive whether
 * something was a retry, because that is the transaction's job.
 */
export interface QuestSessionFacts {
  overallScore: number;
  clarity: number;
  structure: number;
  concision: number;
  delivery: number;
  wordsPerMinute: number;
  fillerWordCount: number;
  /** True when this session completed the day's challenge for the first time. */
  isDailyCompletion: boolean;
  isRetry: boolean;
  /** Retry only: the score this attempt was measured against. */
  scoreToBeat: number | null;
  /** Retry only: filler count of the attempt being retried. */
  fillersToBeat: number | null;
  isPersonalBest: boolean;
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  category: QuestCategory;
  difficulty: QuestDifficulty;
  xpReward: number;
  /**
   * True when this quest can only be satisfied by retrying an earlier attempt.
   * Used to keep retry quests away from users who have nothing to retry yet.
   */
  requiresRetry: boolean;
  /** Pure predicate over one session. */
  isSatisfiedBy: (facts: QuestSessionFacts) => boolean;
}

const STANDARD: Quest[] = [
  {
    id: "clean-run",
    title: "Clean Run",
    description: "Use 5 or fewer filler words",
    category: "delivery",
    difficulty: "standard",
    xpReward: QUEST_XP.standard,
    requiresRetry: false,
    isSatisfiedBy: (f) => f.fillerWordCount <= 5,
  },
  {
    id: "show-up",
    title: "Show Up",
    description: "Complete today's challenge",
    category: "consistency",
    difficulty: "standard",
    xpReward: QUEST_XP.standard,
    requiresRetry: false,
    isSatisfiedBy: (f) => f.isDailyCompletion,
  },
  {
    id: "smooth-pace",
    title: "Smooth Pace",
    description: "Stay between 120 and 170 words per minute",
    category: "delivery",
    difficulty: "standard",
    xpReward: QUEST_XP.standard,
    requiresRetry: false,
    isSatisfiedBy: (f) => f.wordsPerMinute >= 120 && f.wordsPerMinute <= 170,
  },
  {
    id: "run-it-back",
    title: "Run It Back",
    description: "Complete one retry",
    category: "improvement",
    difficulty: "standard",
    xpReward: QUEST_XP.standard,
    requiresRetry: true,
    isSatisfiedBy: (f) => f.isRetry,
  },
];

const STRETCH: Quest[] = [
  {
    id: "crystal-clear",
    title: "Crystal Clear",
    description: "Score 80 or higher in Clarity",
    category: "clarity",
    difficulty: "stretch",
    xpReward: QUEST_XP.stretch,
    requiresRetry: false,
    isSatisfiedBy: (f) => f.clarity >= 80,
  },
  {
    id: "straight-to-it",
    title: "Straight to It",
    description: "Score 80 or higher in Concision",
    category: "clarity",
    difficulty: "stretch",
    xpReward: QUEST_XP.stretch,
    requiresRetry: false,
    isSatisfiedBy: (f) => f.concision >= 80,
  },
  {
    id: "well-structured",
    title: "Well Structured",
    description: "Score 80 or higher in Structure",
    category: "clarity",
    difficulty: "stretch",
    xpReward: QUEST_XP.stretch,
    requiresRetry: false,
    isSatisfiedBy: (f) => f.structure >= 80,
  },
  {
    id: "beat-yourself",
    title: "Beat Yourself",
    description: "Improve your score on a retry",
    category: "improvement",
    difficulty: "stretch",
    xpReward: QUEST_XP.stretch,
    requiresRetry: true,
    isSatisfiedBy: (f) =>
      f.isRetry && f.scoreToBeat !== null && f.overallScore > f.scoreToBeat,
  },
  {
    id: "personal-best",
    title: "Personal Best",
    description: "Set a new overall high score",
    category: "improvement",
    difficulty: "stretch",
    xpReward: QUEST_XP.stretch,
    requiresRetry: false,
    isSatisfiedBy: (f) => f.isPersonalBest,
  },
  {
    id: "cleaner-take",
    title: "Cleaner Take",
    description: "Use fewer filler words on a retry",
    category: "delivery",
    difficulty: "stretch",
    xpReward: QUEST_XP.stretch,
    requiresRetry: true,
    isSatisfiedBy: (f) =>
      f.isRetry &&
      f.fillersToBeat !== null &&
      f.fillerWordCount < f.fillersToBeat,
  },
];

export const QUESTS: Quest[] = [...STANDARD, ...STRETCH];

const BY_ID = new Map(QUESTS.map((quest) => [quest.id, quest]));

export function getQuest(id: string): Quest | undefined {
  return BY_ID.get(id);
}

/**
 * What a user is allowed to be given today.
 *
 * Both inputs are deliberately "as of the start of the day" facts. If
 * eligibility could change partway through a day, so could the assignment, and
 * a user's quests would silently swap out from under them after their first
 * session. See `assignDailyQuests`.
 */
export interface QuestEligibility {
  /** Has at least one completed session from a day before today. */
  hasPracticedBeforeToday: boolean;
}

export function eligibleQuests(
  pool: Quest[],
  eligibility: QuestEligibility,
): Quest[] {
  const usable = pool.filter(
    (quest) => !quest.requiresRetry || eligibility.hasPracticedBeforeToday,
  );
  // A pool must never empty out. If eligibility excluded everything, fall back
  // to the unconditioned quests rather than handing back nothing.
  return usable.length > 0
    ? usable
    : pool.filter((quest) => !quest.requiresRetry);
}

/**
 * A small deterministic hash. Not cryptographic — it only needs to spread
 * uid+date pairs evenly and produce the same number everywhere, forever.
 */
function hash(input: string): number {
  let value = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

export interface DailyQuestAssignment {
  standard: Quest;
  stretch: Quest;
}

/**
 * The two quests a user gets on a given date.
 *
 * Derived from uid + date rather than stored, so it is stable across refreshes
 * without a write, identical on every server, and reproducible for any past
 * date. The daily document still records the ids once the day is touched (see
 * `dailyQuests.ts`), which is what keeps history correct if this registry ever
 * changes.
 */
export function assignDailyQuests(
  uid: string,
  dayKey: string,
  eligibility: QuestEligibility,
): DailyQuestAssignment {
  const standardPool = eligibleQuests(STANDARD, eligibility);
  const stretchPool = eligibleQuests(STRETCH, eligibility);

  // Separate salts, so the two picks are independent rather than moving in
  // lockstep for every user on the same day.
  const standard = standardPool[hash(`${uid}:${dayKey}:standard`) % standardPool.length];
  const stretch = stretchPool[hash(`${uid}:${dayKey}:stretch`) % stretchPool.length];

  return { standard, stretch };
}

/** Assignment as plain ids, which is what gets persisted. */
export function assignDailyQuestIds(
  uid: string,
  dayKey: string,
  eligibility: QuestEligibility,
): string[] {
  const { standard, stretch } = assignDailyQuests(uid, dayKey, eligibility);
  return [standard.id, stretch.id];
}

/**
 * Which of today's quests this session completes.
 *
 * Returns only quests that are not already complete, so awarding is naturally
 * idempotent: a quest already banked today can never be returned again.
 */
export function questsCompletedBy(
  questIds: string[],
  alreadyCompleted: string[],
  facts: QuestSessionFacts,
): Quest[] {
  const done = new Set(alreadyCompleted);
  return questIds
    .filter((id) => !done.has(id))
    .map((id) => getQuest(id))
    .filter((quest): quest is Quest => Boolean(quest))
    .filter((quest) => quest.isSatisfiedBy(facts));
}
