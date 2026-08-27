/**
 * Day keys and streak arithmetic.
 *
 * A "day" here is deliberately the same unit as the prompt of the day: one UTC
 * calendar date, formatted YYYY-MM-DD. When the prompt rolls over, the day rolls
 * over, for everyone at once. That equivalence is the whole reason this file has
 * no timezone handling in it — the alternative, per-user local midnights, means
 * a user's streak and their daily prompt can disagree about what day it is.
 *
 * Everything here is pure so the rules can be tested without Firestore.
 */

export const DAY_MS = 86_400_000;

/** The canonical day key for an instant, e.g. "2026-08-27". */
export function toDayKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/** Parses a day key back to midnight UTC on that date. */
export function fromDayKey(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

export function isValidDayKey(key: unknown): key is string {
  if (typeof key !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const parsed = new Date(`${key}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && toDayKey(parsed) === key;
}

export function shiftDayKey(key: string, days: number): string {
  return toDayKey(new Date(fromDayKey(key).getTime() + days * DAY_MS));
}

/** Whole days from `from` to `to`. Negative when `to` precedes `from`. */
export function daysBetween(from: string, to: string): number {
  return Math.round((fromDayKey(to).getTime() - fromDayKey(from).getTime()) / DAY_MS);
}

export interface StreakState {
  currentStreak: number;
  longestStreak: number;
  /** Day key of the most recent completed session, or null for a new user. */
  lastPracticeDay: string | null;
  /** Distinct days practiced, ever. Drives the "Day 12" label. */
  daysPracticed: number;
}

export interface StreakTransition extends StreakState {
  /** False when this is a repeat session on a day already counted. */
  isNewDay: boolean;
  /** True when a gap ended a streak longer than one day. */
  didReset: boolean;
}

export const INITIAL_STREAK_STATE: StreakState = {
  currentStreak: 0,
  longestStreak: 0,
  lastPracticeDay: null,
  daysPracticed: 0,
};

/**
 * Applies one completed session to a user's streak state.
 *
 * Practising twice in a day is common and must not inflate anything, so a repeat
 * returns the state untouched with `isNewDay: false`. A clock skew or a replayed
 * old session could present a day key in the past; that is treated as a repeat
 * rather than allowed to rewrite history backwards.
 */
export function applyPractice(
  state: StreakState,
  dayKey: string,
): StreakTransition {
  const { lastPracticeDay } = state;

  if (lastPracticeDay) {
    const gap = daysBetween(lastPracticeDay, dayKey);

    if (gap <= 0) {
      return { ...state, isNewDay: false, didReset: false };
    }

    if (gap === 1) {
      const currentStreak = state.currentStreak + 1;
      return {
        currentStreak,
        longestStreak: Math.max(state.longestStreak, currentStreak),
        lastPracticeDay: dayKey,
        daysPracticed: state.daysPracticed + 1,
        isNewDay: true,
        didReset: false,
      };
    }

    return {
      currentStreak: 1,
      longestStreak: Math.max(state.longestStreak, 1),
      lastPracticeDay: dayKey,
      daysPracticed: state.daysPracticed + 1,
      isNewDay: true,
      didReset: true,
    };
  }

  return {
    currentStreak: 1,
    longestStreak: Math.max(state.longestStreak, 1),
    lastPracticeDay: dayKey,
    daysPracticed: state.daysPracticed + 1,
    isNewDay: true,
    didReset: false,
  };
}

/**
 * The streak to *display* on a given day.
 *
 * Stored state is only updated when someone practices, so a user who last
 * practiced three days ago still has `currentStreak: 5` on disk. Showing that
 * would be a lie. A streak survives only if the last session was today or
 * yesterday — yesterday still counts because today is not over yet.
 */
export function visibleStreak(
  state: StreakState,
  today: string = toDayKey(),
): number {
  if (!state.lastPracticeDay) return 0;
  const gap = daysBetween(state.lastPracticeDay, today);
  if (gap <= 0) return state.currentStreak;
  if (gap === 1) return state.currentStreak;
  return 0;
}

/** True when the user has already completed today's challenge. */
export function hasPracticedToday(
  state: StreakState,
  today: string = toDayKey(),
): boolean {
  return state.lastPracticeDay === today;
}

/**
 * The full aggregate a completion updates, not just the streak part.
 *
 * `totalSessions` and `totalPracticeDays` answer different questions and must
 * never be conflated: three sessions on one day is `totalSessions: 3` and
 * `totalPracticeDays: 1`. Conflating them makes a keen user look like a
 * long-running one, which is exactly the number a streak product must get right.
 */
export interface CompletionState extends StreakState {
  totalSessions: number;
}

export const INITIAL_COMPLETION_STATE: CompletionState = {
  ...INITIAL_STREAK_STATE,
  totalSessions: 0,
};

export interface Completion {
  /** True only for the first successful session on this date. */
  isDailyCompletion: boolean;
  /**
   * The streak this session earned, frozen at write time.
   *
   * Stored on the session so an old results page keeps showing the streak the
   * user actually had that day. Deriving it later from current state would make
   * historical pages silently rewrite themselves.
   */
  streakEarned: number;
  /** Aggregate to persist on `users/{uid}` after this session. */
  next: CompletionState;
  didReset: boolean;
}

/**
 * Applies one *successfully persisted* session to a user's aggregate.
 *
 * Pure, so every rule below is verifiable without Firestore. The caller is
 * responsible for only invoking this once a session is known to be good —
 * recording or starting a challenge must not reach here.
 */
export function applyCompletion(
  state: CompletionState,
  challengeDate: string,
): Completion {
  const transition = applyPractice(state, challengeDate);

  return {
    isDailyCompletion: transition.isNewDay,
    // On a repeat, `applyPractice` returns the streak untouched, which is
    // exactly the value this session earned.
    streakEarned: transition.currentStreak,
    next: {
      currentStreak: transition.currentStreak,
      longestStreak: transition.longestStreak,
      lastPracticeDay: transition.lastPracticeDay,
      daysPracticed: transition.daysPracticed,
      // Every completed attempt counts, retries included.
      totalSessions: state.totalSessions + 1,
    },
    didReset: transition.didReset,
  };
}
