import "server-only";

import { FieldValue, Timestamp, type DocumentReference } from "firebase-admin/firestore";
import { getDb } from "./firebase/admin";
import {
  INITIAL_COMPLETION_STATE,
  INITIAL_STREAK_STATE,
  type Completion,
  type CompletionState,
  type StreakState,
} from "./streaks";
import { getLevelProgress, type LevelProgress } from "./gamification/levels";

export const USERS_COLLECTION = "users";

/**
 * Per-user state: profile, streak, and lifetime totals.
 *
 * Streak counters live here rather than being derived by scanning sessions.
 * Deriving would mean reading a user's whole history on every page load, and the
 * cost grows with the most engaged users — exactly the wrong direction.
 */
export interface UserDoc {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  /** Set once, on the write that creates the document. Never rewritten. */
  createdAt: Timestamp;
  updatedAt: Timestamp;
  /** Refreshed on every sign-in. The cheapest signal of an active account. */
  lastSeenAt: Timestamp;

  currentStreak: number;
  longestStreak: number;
  /** Canonical day key for streak arithmetic. See `lastPracticeDate`. */
  lastPracticeDay: string | null;
  daysPracticed: number;

  /**
   * Unique calendar days with at least one completed session. Distinct from
   * `totalSessions`, which counts every attempt: three sessions in one day is
   * three sessions and one practice day.
   */
  totalPracticeDays: number;

  /**
   * Day key of the first ever recorded session. Set once and never rewritten,
   * so "member since" survives a lapsed streak.
   */
  firstPracticeDate: string | null;
  /**
   * Same value as `lastPracticeDay`, under the name the rest of the product
   * uses. Both are written in the same transaction from one source, so they
   * cannot drift; `lastPracticeDay` is what the pure streak functions consume.
   */
  lastPracticeDate: string | null;
  /**
   * Day key of the last day this user completed a challenge. Equal to
   * `lastPracticeDate` today, but kept separate because "practiced" and
   * "completed the day's challenge" will diverge if practice ever becomes
   * possible without finishing a prompt.
   */
  lastCompletedChallengeDate: string | null;

  totalSessions: number;
  /** Overall score of the previous session, used for the results-page delta. */
  lastOverallScore: number | null;
  /**
   * Best overall score ever recorded. The bar a personal best must clear.
   * Server-written only, so a client cannot declare itself a record holder.
   */
  bestOverallScore: number | null;
  /**
   * Lifetime XP. Level is *derived* from this (see `gamification/levels.ts`)
   * and deliberately not stored, so the two can never disagree.
   */
  totalXp: number;
}

export interface UserProfileInput {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
}

function collection() {
  return getDb().collection(USERS_COLLECTION);
}

/** Shared with `lib/sessions.ts`, which writes this document transactionally. */
export function userDocRef(uid: string): DocumentReference {
  return collection().doc(uid);
}

function toStreakState(doc: Partial<UserDoc> | undefined): StreakState {
  if (!doc) return { ...INITIAL_STREAK_STATE };
  return {
    currentStreak: doc.currentStreak ?? 0,
    longestStreak: doc.longestStreak ?? 0,
    // `daysPracticed` is the older name for the same count; either may be
    // present depending on when the document was last written.
    lastPracticeDay: doc.lastPracticeDay ?? null,
    daysPracticed: doc.totalPracticeDays ?? doc.daysPracticed ?? 0,
  };
}

/** Reads the aggregate a completion operates on, tolerating older documents. */
export function toCompletionState(
  doc: Partial<UserDoc> | undefined,
): CompletionState {
  if (!doc) return { ...INITIAL_COMPLETION_STATE };
  return {
    ...toStreakState(doc),
    totalSessions: doc.totalSessions ?? 0,
  };
}

export interface CompletionRecord {
  sessionId: string;
  /** Streak this session earned, frozen onto the session document. */
  streakEarned: number;
  isDailyCompletion: boolean;
  /** Distinct days practiced, shown as "Day N". */
  dayNumber: number;
  longestStreak: number;
  /** Overall score of the prior session, or undefined for a first session. */
  previousScore?: number;

  // Gamification outcome, returned so the API can log and the client can route
  // without a second read.
  isRetry: boolean;
  attemptNumber: number;
  xpEarned: number;
  totalXp: number;
  level: number;
  didLevelUp: boolean;
  questsCompleted: string[];
  isPersonalBest: boolean;
}

export const XP_EVENTS_COLLECTION = "xpEvents";

/**
 * One awarded XP event, at `users/{uid}/xpEvents/{eventId}`.
 *
 * The document id *is* the idempotency key — see `gamification/xp.ts`. Existence
 * means "already paid", which is why awarding checks for the document rather
 * than tracking a count anywhere.
 */
export function xpEventRef(uid: string, eventId: string): DocumentReference {
  return userDocRef(uid).collection(XP_EVENTS_COLLECTION).doc(eventId);
}

/**
 * The `users/{uid}` half of a completion, as a merge payload.
 *
 * Kept separate from the transaction that applies it so the field-by-field
 * decisions — which are set-once, which advance — are readable in one place.
 */
export function buildAggregateUpdate({
  uid,
  completion,
  challengeDate,
  existing,
  isNewDocument,
  overallScore,
}: {
  uid: string;
  completion: Completion;
  challengeDate: string;
  existing: Partial<UserDoc> | undefined;
  isNewDocument: boolean;
  overallScore: number;
}): Record<string, unknown> {
  const { next } = completion;

  const update: Record<string, unknown> = {
    uid,
    currentStreak: next.currentStreak,
    longestStreak: next.longestStreak,
    // One source, three names, written together so they cannot drift.
    lastPracticeDay: next.lastPracticeDay,
    lastPracticeDate: next.lastPracticeDay,
    lastCompletedChallengeDate: next.lastPracticeDay,
    // Both names for the unique-day count, likewise written as one value.
    daysPracticed: next.daysPracticed,
    totalPracticeDays: next.daysPracticed,
    totalSessions: next.totalSessions,
    lastOverallScore: overallScore,
    updatedAt: FieldValue.serverTimestamp(),
  };

  // Set once. `??=` would rewrite it whenever the stored value is null, so the
  // existing value is checked explicitly.
  if (!existing?.firstPracticeDate) {
    update.firstPracticeDate = challengeDate;
  }

  // A session can arrive before the sign-in handler created the document — a
  // first practice on a repaired cookie, say. Backfill the creation-only fields
  // rather than leave a document with no createdAt.
  if (isNewDocument) {
    update.createdAt = FieldValue.serverTimestamp();
    update.lastSeenAt = FieldValue.serverTimestamp();
  }

  return update;
}

/**
 * Gamification fields as they exist before a user has ever practiced.
 *
 * Written only on document creation. Every later write merges, so these are set
 * exactly once and a returning user's real counters are never reset to them.
 */
const INITIAL_PRACTICE_STATE = {
  ...INITIAL_STREAK_STATE,
  totalPracticeDays: 0,
  firstPracticeDate: null,
  lastPracticeDate: null,
  lastCompletedChallengeDate: null,
  totalSessions: 0,
  lastOverallScore: null,
  bestOverallScore: null,
  totalXp: 0,
} as const;

/**
 * Creates or refreshes the profile half of the user document on sign-in.
 *
 * Merges, so it can never clobber streak counters — a detail worth being
 * deliberate about, since this runs on every sign-in.
 *
 * Timestamps are server-generated. A client clock is attacker-controlled and a
 * server process clock still drifts; `serverTimestamp()` is the only value here
 * that is both consistent across instances and not user-supplied.
 */
export async function ensureUser(input: UserProfileInput): Promise<void> {
  const db = getDb();
  const ref = collection().doc(input.uid);

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const now = FieldValue.serverTimestamp();

    const profile = {
      uid: input.uid,
      email: input.email ?? null,
      displayName: input.displayName ?? null,
      photoURL: input.photoURL ?? null,
      updatedAt: now,
      lastSeenAt: now,
    };

    if (snapshot.exists) {
      // Profile only. Streak counters and createdAt are left exactly as they
      // are: `createdAt` is absent from this object, and merge leaves an
      // untouched field alone rather than clearing it.
      transaction.set(ref, profile, { merge: true });
      return;
    }

    transaction.set(ref, {
      ...profile,
      createdAt: now,
      ...INITIAL_PRACTICE_STATE,
    });
  });
}

/**
 * Everything the product needs to render a user's gamification state.
 *
 * A single document read. The alternative — deriving these by scanning session
 * history — costs a read per session and grows with the most engaged users.
 */
export interface UserGamification {
  uid: string;
  currentStreak: number;
  longestStreak: number;
  /** Every completed attempt, retries included. */
  totalSessions: number;
  /** Unique calendar days with at least one completion. */
  totalPracticeDays: number;
  firstPracticeDate: string | null;
  lastPracticeDate: string | null;
  lastCompletedChallengeDate: string | null;
  lastOverallScore: number | null;
  bestOverallScore: number | null;
  totalXp: number;
  /** Derived from `totalXp`, never stored. */
  level: number;
  levelProgress: LevelProgress;
  /** The raw document, for callers that need quest eligibility. */
  doc: Partial<UserDoc> | undefined;
}

export async function getUserGamification(
  uid: string,
): Promise<UserGamification> {
  const snapshot = await collection().doc(uid).get();
  const data = snapshot.exists
    ? (snapshot.data() as Partial<UserDoc>)
    : undefined;

  const state = toCompletionState(data);
  const lastPracticeDate = data?.lastPracticeDate ?? state.lastPracticeDay;
  const totalXp = data?.totalXp ?? 0;
  const levelProgress = getLevelProgress(totalXp);

  return {
    uid,
    currentStreak: state.currentStreak,
    longestStreak: state.longestStreak,
    totalSessions: state.totalSessions,
    totalPracticeDays: state.daysPracticed,
    firstPracticeDate: data?.firstPracticeDate ?? null,
    lastPracticeDate,
    lastCompletedChallengeDate:
      data?.lastCompletedChallengeDate ?? lastPracticeDate,
    lastOverallScore: data?.lastOverallScore ?? null,
    bestOverallScore: data?.bestOverallScore ?? null,
    totalXp,
    level: levelProgress.level,
    levelProgress,
    doc: data,
  };
}
