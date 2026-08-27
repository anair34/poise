import "server-only";

import { Timestamp } from "firebase-admin/firestore";
import { getDb } from "./firebase/admin";
import { dailyPromptId } from "./dailyPrompts";
import { applyCompletion, isValidDayKey } from "./streaks";
import {
  buildAggregateUpdate,
  toCompletionState,
  userDocRef,
  type CompletionRecord,
  type UserDoc,
} from "./users";
import type { Category, ScoringSource, Session } from "./types";

export const SESSIONS_COLLECTION = "practiceSessions";

/** Flat Firestore document shape. Kept flat so it stays queryable. */
export interface SessionDoc {
  id: string;
  /**
   * Owner. Always taken from the verified session cookie, never from anything
   * the browser sent.
   */
  userId: string;
  /**
   * The prompt actually answered. Differs from `challengeId` when the user
   * retries an older prompt: the answer is to that prompt, but the session
   * still counts toward today's challenge.
   */
  promptId: string;
  prompt: string;
  promptCategory: string;
  createdAt: Timestamp;
  /**
   * The UTC calendar day this session counts toward, matching the daily prompt
   * and the streak. Stored alongside `createdAt` because streak questions are
   * asked in days, and deriving the day from a timestamp in a Firestore query
   * is not possible.
   */
  challengeDate: string;
  /** Which daily challenge slot this filled, i.e. `daily-{challengeDate}`. */
  challengeId: string;
  /**
   * True only for the first successful session on `challengeDate`. Retries the
   * same day are real sessions but not new completions.
   */
  isDailyCompletion: boolean;
  /**
   * The streak this session earned, frozen at write time so an old results page
   * never rewrites itself.
   */
  streakEarned: number;
  durationSeconds: number;
  transcript: string;

  overallScore: number;
  clarityScore: number;
  structureScore: number;
  concisionScore: number;
  deliveryScore: number;
  /** Overall score of this user's previous session, frozen at write time. */
  previousScore: number | null;

  wordCount: number;
  wordsPerMinute: number;
  fillerWordCount: number;
  fillerWords: { word: string; count: number }[];

  // Deterministic metrics, flat so progress analytics can query and chart them
  // over time ("your filler rate halved this month").
  fillerRate: number | null;
  hedgeCount: number | null;
  hedgeRate: number | null;
  repetitionRate: number | null;
  lexicalDiversity: number | null;

  strength: { title: string; detail: string } | null;
  improvement: { title: string; detail: string } | null;
  exampleRewrite: string | null;
  summary: string;
  encouragement: string | null;
  scoreNotes: Record<string, string> | null;

  // Provenance for the scores above. Without it, a prompt or model change
  // silently makes every historical score incomparable.
  scoringSource: ScoringSource;
  modelVersion: string | null;

  dayNumber: number;
}

/**
 * Documents written before the completion model existed use `dayKey` and
 * `streak`. Reads go through here so one older document cannot crash a page.
 */
type LegacySessionDoc = SessionDoc & {
  dayKey?: string;
  streak?: number;
};

export interface CreateSessionInput {
  session: Session;
  /** Required: every session belongs to exactly one signed-in user. */
  userId: string;
  challengeDate: string;
  isDailyCompletion: boolean;
  streakEarned: number;
  scoringSource?: ScoringSource;
  modelVersion?: string;
}

function toDoc({
  session,
  userId,
  challengeDate,
  isDailyCompletion,
  streakEarned,
  scoringSource = "llm",
  modelVersion,
}: CreateSessionInput): SessionDoc {
  return {
    id: session.id,
    userId,
    promptId: session.promptId,
    prompt: session.promptText,
    promptCategory: session.category,
    createdAt: Timestamp.fromDate(new Date(session.createdAt)),
    challengeDate,
    challengeId: dailyPromptId(challengeDate),
    isDailyCompletion,
    streakEarned,
    durationSeconds: session.metrics.durationSeconds,
    transcript: session.transcript,

    overallScore: session.overallScore,
    clarityScore: session.scores.clarity,
    structureScore: session.scores.structure,
    concisionScore: session.scores.concision,
    deliveryScore: session.scores.delivery,
    previousScore: session.previousScore ?? null,

    wordCount: session.metrics.wordCount,
    wordsPerMinute: session.metrics.wordsPerMinute,
    fillerWordCount: session.metrics.fillerWordCount,
    fillerWords: session.metrics.fillerWords ?? [],

    fillerRate: session.metrics.fillerRate ?? null,
    hedgeCount: session.metrics.hedgeCount ?? null,
    hedgeRate: session.metrics.hedgeRate ?? null,
    repetitionRate: session.metrics.repetitionRate ?? null,
    lexicalDiversity: session.metrics.lexicalDiversity ?? null,

    strength: session.feedback.strength ?? null,
    improvement: session.feedback.opportunity ?? null,
    exampleRewrite: session.feedback.rewrite ?? null,
    summary: session.feedback.summary,
    encouragement: session.feedback.encouragement ?? null,
    scoreNotes: session.scoreNotes ? { ...session.scoreNotes } : null,

    scoringSource,
    modelVersion: modelVersion ?? null,

    dayNumber: session.dayNumber,
  };
}

function fromDoc(doc: LegacySessionDoc): Session {
  const createdAt =
    doc.createdAt instanceof Timestamp
      ? doc.createdAt.toDate().toISOString()
      : new Date().toISOString();

  return {
    id: doc.id,
    createdAt,
    // Documents written before challengeDate existed fall back to the day they
    // were created on, which is the same value the field would have held.
    challengeDate: isValidDayKey(doc.challengeDate)
      ? doc.challengeDate
      : createdAt.slice(0, 10),
    promptId: doc.promptId,
    promptText: doc.prompt,
    category: doc.promptCategory as Category,
    transcript: doc.transcript,
    overallScore: doc.overallScore,
    scores: {
      clarity: doc.clarityScore,
      structure: doc.structureScore,
      concision: doc.concisionScore,
      delivery: doc.deliveryScore,
    },
    scoreNotes: doc.scoreNotes ?? undefined,
    previousScore: doc.previousScore ?? undefined,
    // Every optional field uses `?? undefined` so a document written before it
    // existed reads cleanly instead of surfacing null into the UI.
    metrics: {
      wordCount: doc.wordCount,
      wordsPerMinute: doc.wordsPerMinute,
      fillerWordCount: doc.fillerWordCount,
      fillerWords: doc.fillerWords ?? [],
      durationSeconds: doc.durationSeconds,
      fillerRate: doc.fillerRate ?? undefined,
      hedgeCount: doc.hedgeCount ?? undefined,
      hedgeRate: doc.hedgeRate ?? undefined,
      repetitionRate: doc.repetitionRate ?? undefined,
      lexicalDiversity: doc.lexicalDiversity ?? undefined,
    },
    feedback: {
      summary: doc.summary,
      strength: doc.strength ?? undefined,
      opportunity: doc.improvement ?? undefined,
      rewrite: doc.exampleRewrite ?? undefined,
      encouragement: doc.encouragement ?? undefined,
    },
    streak: doc.streakEarned ?? doc.streak ?? 0,
    dayNumber: doc.dayNumber,
    scoringSource: doc.scoringSource ?? undefined,
  };
}

function collection() {
  return getDb().collection(SESSIONS_COLLECTION);
}

/**
 * Writes a completed session and advances the user's aggregate, atomically.
 *
 * These were previously two sequential writes, which had a real failure mode: a
 * streak could be incremented for a session that then failed to save, leaving a
 * user with a streak and no session behind it. Doing both in one transaction
 * means a completion is all-or-nothing.
 *
 * The transaction is also what makes concurrent submissions safe. Two requests
 * landing together would otherwise both read the same starting streak and write
 * back the same incremented value, losing a day and making the result depend on
 * timing. Firestore aborts and retries the loser against fresh state, so the
 * second submission sees the first one's write and is correctly classified as a
 * same-day retry.
 */
export async function recordCompletedSession(
  input: Omit<CreateSessionInput, "isDailyCompletion" | "streakEarned">,
): Promise<CompletionRecord> {
  const db = getDb();
  const sessionRef = collection().doc(input.session.id);
  const userRef = userDocRef(input.userId);

  return db.runTransaction(async (transaction) => {
    // Every read must precede every write inside a Firestore transaction.
    const userSnapshot = await transaction.get(userRef);
    const userData = userSnapshot.exists
      ? (userSnapshot.data() as Partial<UserDoc>)
      : undefined;

    const completion = applyCompletion(
      toCompletionState(userData),
      input.challengeDate,
    );
    const previousScore = userData?.lastOverallScore ?? null;

    transaction.set(
      sessionRef,
      toDoc({
        ...input,
        isDailyCompletion: completion.isDailyCompletion,
        streakEarned: completion.streakEarned,
        session: {
          ...input.session,
          streak: completion.streakEarned,
          dayNumber: completion.next.daysPracticed,
          previousScore: previousScore ?? undefined,
        },
      }),
    );

    transaction.set(
      userRef,
      buildAggregateUpdate({
        uid: input.userId,
        completion,
        challengeDate: input.challengeDate,
        existing: userData,
        isNewDocument: !userSnapshot.exists,
        overallScore: input.session.overallScore,
      }),
      { merge: true },
    );

    return {
      sessionId: input.session.id,
      streakEarned: completion.streakEarned,
      isDailyCompletion: completion.isDailyCompletion,
      dayNumber: completion.next.daysPracticed,
      longestStreak: completion.next.longestStreak,
      previousScore: previousScore ?? undefined,
    };
  });
}

/**
 * Fetches a session, but only for the user who recorded it.
 *
 * The owner check is here, in the data layer, rather than in the page. Session
 * ids are unguessable UUIDs, but "hard to guess" is not access control — ids get
 * shared, logged, and pasted into chats, and a transcript of someone speaking is
 * exactly the kind of thing that should not leak on a copied link.
 *
 * Returns null for both "no such session" and "not yours", so callers cannot
 * distinguish the two and confirm a session exists.
 */
export async function getSessionForUser(
  id: string,
  userId: string,
): Promise<Session | null> {
  if (!id || !userId) return null;
  const snapshot = await collection().doc(id).get();
  if (!snapshot.exists) return null;

  const doc = snapshot.data() as SessionDoc;
  if (doc.userId !== userId) return null;
  return fromDoc(doc);
}

/**
 * Every session for a user, newest first.
 *
 * Unbounded by name but not in practice: `max` defaults to a page's worth and
 * an unlimited read of a heavy user's history is never what a page wants.
 */
export async function getUserSessions(
  userId: string,
  max = 200,
): Promise<Session[]> {
  if (!userId) return [];
  const snapshot = await collection()
    .where("userId", "==", userId)
    .orderBy("createdAt", "desc")
    .limit(max)
    .get();
  return snapshot.docs.map((doc) => fromDoc(doc.data() as LegacySessionDoc));
}

export async function getRecentUserSessions(
  userId: string,
  limit = 30,
): Promise<Session[]> {
  return getUserSessions(userId, limit);
}

/**
 * Sessions between two day keys, inclusive.
 *
 * Ranged on `challengeDate` rather than `createdAt` because the question a
 * calendar asks is "which days did they complete", and a session's day is the
 * challenge it counted toward — not the instant the upload finished, which can
 * land on the other side of midnight.
 */
export async function getUserSessionsForDateRange(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<Session[]> {
  if (!userId) return [];
  if (!isValidDayKey(startDate) || !isValidDayKey(endDate)) return [];

  const snapshot = await collection()
    .where("userId", "==", userId)
    .where("challengeDate", ">=", startDate)
    .where("challengeDate", "<=", endDate)
    .orderBy("challengeDate", "asc")
    .get();
  return snapshot.docs.map((doc) => fromDoc(doc.data() as LegacySessionDoc));
}

/**
 * Whether a user completed the challenge on a given date.
 *
 * Asks for one document rather than counting: existence is the whole answer,
 * and `limit(1)` keeps the cost flat no matter how many retries that day holds.
 */
export async function hasCompletedChallengeOnDate(
  userId: string,
  dateKey: string,
): Promise<boolean> {
  if (!userId || !isValidDayKey(dateKey)) return false;

  const snapshot = await collection()
    .where("userId", "==", userId)
    .where("challengeDate", "==", dateKey)
    .limit(1)
    .get();
  return !snapshot.empty;
}
