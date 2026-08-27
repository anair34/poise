import "server-only";

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getDb } from "./firebase/admin";
import {
  INITIAL_STREAK_STATE,
  applyPractice,
  type StreakState,
} from "./streaks";

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

function toStreakState(doc: Partial<UserDoc> | undefined): StreakState {
  if (!doc) return { ...INITIAL_STREAK_STATE };
  return {
    currentStreak: doc.currentStreak ?? 0,
    longestStreak: doc.longestStreak ?? 0,
    lastPracticeDay: doc.lastPracticeDay ?? null,
    daysPracticed: doc.daysPracticed ?? 0,
  };
}

/**
 * Gamification fields as they exist before a user has ever practiced.
 *
 * Written only on document creation. Every later write merges, so these are set
 * exactly once and a returning user's real counters are never reset to them.
 */
const INITIAL_PRACTICE_STATE = {
  ...INITIAL_STREAK_STATE,
  firstPracticeDate: null,
  lastPracticeDate: null,
  lastCompletedChallengeDate: null,
  totalSessions: 0,
  lastOverallScore: null,
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

export interface UserState extends StreakState {
  uid: string;
  totalSessions: number;
  lastOverallScore: number | null;
}

export async function getUserState(uid: string): Promise<UserState> {
  const snapshot = await collection().doc(uid).get();
  const data = snapshot.exists
    ? (snapshot.data() as Partial<UserDoc>)
    : undefined;

  return {
    uid,
    ...toStreakState(data),
    totalSessions: data?.totalSessions ?? 0,
    lastOverallScore: data?.lastOverallScore ?? null,
  };
}

export interface PracticeRecord {
  /** Streak after this session. */
  streak: number;
  longestStreak: number;
  /** Distinct days practiced, shown as "Day N". */
  dayNumber: number;
  /** Overall score of the prior session, or undefined for a first session. */
  previousScore?: number;
  isNewDay: boolean;
}

/**
 * Records a completed session against a user's streak.
 *
 * Runs in a transaction because two submissions landing together would
 * otherwise both read the same starting streak and each write back the same
 * incremented value — losing one day and, worse, making the streak
 * non-deterministic. Firestore retries the transaction on contention.
 */
export async function recordPractice({
  uid,
  dayKey,
  overallScore,
}: {
  uid: string;
  dayKey: string;
  overallScore: number;
}): Promise<PracticeRecord> {
  const db = getDb();
  const ref = collection().doc(uid);

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const data = snapshot.exists
      ? (snapshot.data() as Partial<UserDoc>)
      : undefined;

    const previous = toStreakState(data);
    const transition = applyPractice(previous, dayKey);
    const previousScore = data?.lastOverallScore ?? null;

    const update: Record<string, unknown> = {
      uid,
      currentStreak: transition.currentStreak,
      longestStreak: transition.longestStreak,
      // One source, three field names, written together — they cannot drift.
      lastPracticeDay: transition.lastPracticeDay,
      lastPracticeDate: transition.lastPracticeDay,
      lastCompletedChallengeDate: transition.lastPracticeDay,
      daysPracticed: transition.daysPracticed,
      totalSessions: (data?.totalSessions ?? 0) + 1,
      lastOverallScore: overallScore,
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Set once. `??=` would still rewrite it whenever the stored value is null,
    // so the existing value is checked explicitly.
    if (!data?.firstPracticeDate) {
      update.firstPracticeDate = transition.lastPracticeDay;
    }

    // A session can reach this before the sign-in handler has created the
    // document — a first practice on a repaired cookie, say. Backfill the
    // fields that are only ever written at creation, so the document is never
    // left without a createdAt.
    if (!snapshot.exists) {
      update.createdAt = FieldValue.serverTimestamp();
      update.lastSeenAt = FieldValue.serverTimestamp();
    }

    transaction.set(ref, update, { merge: true });

    return {
      streak: transition.currentStreak,
      longestStreak: transition.longestStreak,
      dayNumber: transition.daysPracticed,
      previousScore: previousScore ?? undefined,
      isNewDay: transition.isNewDay,
    };
  });
}
