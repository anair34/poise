import "server-only";

import { Timestamp } from "firebase-admin/firestore";
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
  createdAt: Timestamp;
  updatedAt: Timestamp;

  currentStreak: number;
  longestStreak: number;
  lastPracticeDay: string | null;
  daysPracticed: number;

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
 * Creates or refreshes the profile half of the user document on sign-in.
 *
 * Merges, so it can never clobber streak counters — a detail worth being
 * deliberate about, since this runs on every sign-in.
 */
export async function ensureUser(input: UserProfileInput): Promise<void> {
  const db = getDb();
  const ref = collection().doc(input.uid);

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const now = Timestamp.now();

    const profile = {
      uid: input.uid,
      email: input.email ?? null,
      displayName: input.displayName ?? null,
      photoURL: input.photoURL ?? null,
      updatedAt: now,
    };

    if (snapshot.exists) {
      // Profile only. Streak counters and createdAt are left exactly as they are.
      transaction.set(ref, profile, { merge: true });
      return;
    }

    transaction.set(ref, {
      ...profile,
      createdAt: now,
      ...INITIAL_STREAK_STATE,
      totalSessions: 0,
      lastOverallScore: null,
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

    transaction.set(
      ref,
      {
        uid,
        currentStreak: transition.currentStreak,
        longestStreak: transition.longestStreak,
        lastPracticeDay: transition.lastPracticeDay,
        daysPracticed: transition.daysPracticed,
        totalSessions: (data?.totalSessions ?? 0) + 1,
        lastOverallScore: overallScore,
        updatedAt: Timestamp.now(),
      },
      { merge: true },
    );

    return {
      streak: transition.currentStreak,
      longestStreak: transition.longestStreak,
      dayNumber: transition.daysPracticed,
      previousScore: previousScore ?? undefined,
      isNewDay: transition.isNewDay,
    };
  });
}
