import "server-only";

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getDb } from "./firebase/admin";
import { dailyPromptId } from "./dailyPrompts";
import { applyCompletion, applyRetry, isValidDayKey } from "./streaks";
import {
  buildAggregateUpdate,
  toCompletionState,
  userDocRef,
  xpEventRef,
  type CompletionRecord,
  type UserDoc,
} from "./users";
import {
  buildQuestUpdate,
  dailyQuestRef,
  eligibilityFor,
  type DailyQuestDoc,
} from "./gamification/dailyQuests";
import {
  assignDailyQuestIds,
  questsCompletedBy,
  type QuestSessionFacts,
} from "./gamification/quests";
import { buildXpEvents, sumXp } from "./gamification/xp";
import { didLevelUp, getLevelFromXp } from "./gamification/levels";
import type { ConstrainedScoring } from "./scoring/constraints.ts";
import type {
  Category,
  Scores,
  ScoringSource,
  ScoringStatus,
  Session,
} from "./types";

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
  /**
   * Which calibration produced these scores. Absent on sessions written before
   * scoring v2, which are read back as `"v1"`. Old sessions are never rescored.
   */
  scoringVersion: string | null;
  scoringStatus: ScoringStatus | null;
  /**
   * Debugging metadata: what the model returned before deterministic ceilings,
   * and which ceilings actually bound a score. Server-side only — no UI reads
   * these, but without them a surprising score cannot be explained after the
   * fact.
   */
  rawScores: Scores | null;
  rawOverallScore: number | null;
  completenessTier: string | null;
  appliedCaps: string[] | null;

  dayNumber: number;

  /**
   * Retry lineage. `retryOfSessionId` always points at the *root* attempt, so
   * attempt 4 still compares against attempt 1 rather than walking a chain.
   * Null on a first attempt.
   */
  retryOfSessionId: string | null;
  attemptNumber: number;

  // Gamification outcome, frozen at write time. Recomputing these on read would
  // let a later change to the XP curve or the quest registry silently rewrite
  // what a past session earned.
  xpEarned: number;
  totalXpAfter: number;
  levelAfter: number;
  didLevelUp: boolean;
  questsCompleted: string[];
  isPersonalBest: boolean;
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
  /** Full constraint result, for the debugging fields on the document. */
  scoring?: ConstrainedScoring;
  retryOfSessionId?: string | null;
  attemptNumber?: number;
  gamification?: {
    xpEarned: number;
    totalXpAfter: number;
    levelAfter: number;
    didLevelUp: boolean;
    questsCompleted: string[];
    isPersonalBest: boolean;
  };
}

function toDoc({
  session,
  userId,
  challengeDate,
  isDailyCompletion,
  streakEarned,
  scoringSource = "llm",
  modelVersion,
  scoring,
  retryOfSessionId = null,
  attemptNumber = 1,
  gamification,
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
    scoringVersion: scoring?.scoringVersion ?? session.scoringVersion ?? null,
    scoringStatus: scoring?.status ?? session.scoringStatus ?? null,
    rawScores: scoring?.rawScores ?? null,
    rawOverallScore: scoring?.rawOverallScore ?? null,
    completenessTier: scoring?.completeness.tier ?? null,
    appliedCaps:
      scoring?.appliedCaps.map(
        (cap) => `${cap.dimension}:${cap.from}->${cap.cap} ${cap.reason}`,
      ) ?? null,

    dayNumber: session.dayNumber,

    retryOfSessionId,
    attemptNumber,

    xpEarned: gamification?.xpEarned ?? 0,
    totalXpAfter: gamification?.totalXpAfter ?? 0,
    levelAfter: gamification?.levelAfter ?? 1,
    didLevelUp: gamification?.didLevelUp ?? false,
    questsCompleted: gamification?.questsCompleted ?? [],
    isPersonalBest: gamification?.isPersonalBest ?? false,
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
    // Sessions written before scoring v2 carry no version. They are reported as
    // "v1" rather than rescored: their numbers meant something at the time, and
    // rewriting history would move scores a user has already seen.
    scoringVersion: doc.scoringVersion ?? "v1",
    scoringStatus: doc.scoringStatus ?? "scored",

    retryOfSessionId: doc.retryOfSessionId ?? null,
    attemptNumber: doc.attemptNumber ?? 1,
    gamification: {
      xpEarned: doc.xpEarned ?? 0,
      totalXp: doc.totalXpAfter ?? 0,
      level: doc.levelAfter ?? 1,
      didLevelUp: doc.didLevelUp ?? false,
      questsCompleted: doc.questsCompleted ?? [],
      isPersonalBest: doc.isPersonalBest ?? false,
      streak: doc.streakEarned ?? doc.streak ?? 0,
    },
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
  input: Omit<CreateSessionInput, "isDailyCompletion" | "streakEarned"> & {
    /** Client-supplied id of the attempt being retried. Verified below. */
    retryOfSessionId?: string | null;
  },
): Promise<CompletionRecord> {
  const db = getDb();
  const sessionRef = collection().doc(input.session.id);
  const userRef = userDocRef(input.userId);
  const questRef = dailyQuestRef(input.userId, input.challengeDate);

  // The parent is read inside the transaction so its ownership is checked
  // against fresh data. A client can name any session id; only one it actually
  // owns is allowed to become a retry parent.
  const parentRef = input.retryOfSessionId
    ? collection().doc(input.retryOfSessionId)
    : null;

  return db.runTransaction(async (transaction) => {
    // ---- reads. Every read must precede every write in a transaction. ----
    const [userSnapshot, questSnapshot] = await Promise.all([
      transaction.get(userRef),
      transaction.get(questRef),
    ]);
    const parentSnapshot = parentRef ? await transaction.get(parentRef) : null;

    const userData = userSnapshot.exists
      ? (userSnapshot.data() as Partial<UserDoc>)
      : undefined;
    const questData = questSnapshot.exists
      ? (questSnapshot.data() as Partial<DailyQuestDoc>)
      : undefined;

    // A parent that is missing, or belongs to someone else, is silently
    // demoted to "not a retry" rather than trusted or thrown at: the recording
    // is real and the user should still get their session.
    const parentDoc =
      parentSnapshot?.exists &&
      (parentSnapshot.data() as SessionDoc).userId === input.userId
        ? (parentSnapshot.data() as SessionDoc)
        : null;

    const isRetry = Boolean(parentDoc);
    // Point at the root attempt, so a chain of retries all compare to attempt 1.
    const rootId = parentDoc
      ? (parentDoc.retryOfSessionId ?? parentDoc.id)
      : null;
    const attemptNumber = parentDoc ? (parentDoc.attemptNumber ?? 1) + 1 : 1;

    const state = toCompletionState(userData);
    // A retry is a session but never a completion: it cannot move the streak
    // or add a practice day.
    const completion = isRetry
      ? applyRetry(state)
      : applyCompletion(state, input.challengeDate);

    const previousScore = userData?.lastOverallScore ?? null;
    const overallScore = input.session.overallScore;

    // ---- personal best ----------------------------------------------------
    // Only meaningful once there is something to beat, so a first ever session
    // sets the bar rather than being celebrated as a record.
    const bestBefore = userData?.bestOverallScore ?? null;
    const hadPriorSession = state.totalSessions > 0;
    const isPersonalBest =
      hadPriorSession && overallScore > (bestBefore ?? Number.NEGATIVE_INFINITY);

    // ---- quests -----------------------------------------------------------
    const questIds =
      questData?.questIds && questData.questIds.length > 0
        ? questData.questIds
        : assignDailyQuestIds(
            input.userId,
            input.challengeDate,
            eligibilityFor(userData, input.challengeDate),
          );

    const scoreToBeat = parentDoc?.overallScore ?? null;
    const facts: QuestSessionFacts = {
      overallScore,
      clarity: input.session.scores.clarity,
      structure: input.session.scores.structure,
      concision: input.session.scores.concision,
      delivery: input.session.scores.delivery,
      wordsPerMinute: input.session.metrics.wordsPerMinute,
      fillerWordCount: input.session.metrics.fillerWordCount,
      isDailyCompletion: completion.isDailyCompletion,
      isRetry,
      scoreToBeat,
      fillersToBeat: parentDoc?.fillerWordCount ?? null,
      isPersonalBest,
    };

    const newlyCompleted = questsCompletedBy(
      questIds,
      questData?.completed ?? [],
      facts,
    );

    // ---- XP ---------------------------------------------------------------
    const candidates = buildXpEvents({
      dayKey: input.challengeDate,
      sessionId: input.session.id,
      isDailyCompletion: completion.isDailyCompletion,
      isRetry,
      retryImproved: isRetry && scoreToBeat !== null && overallScore > scoreToBeat,
      isPersonalBest,
      questsCompleted: newlyCompleted,
    });

    // Idempotency: an event id that already exists has already been paid for.
    // This is what makes a double-submit or a retried request safe, and the
    // transaction is what makes it safe under concurrency.
    const eventRefs = candidates.map((event) =>
      xpEventRef(input.userId, event.id),
    );
    const existingEvents =
      eventRefs.length > 0 ? await transaction.getAll(...eventRefs) : [];
    const pending = candidates
      .map((event, index) => ({ event, ref: eventRefs[index] }))
      .filter((_, index) => !existingEvents[index]?.exists);
    const awarded = pending.map((entry) => entry.event);

    const xpEarned = sumXp(awarded);
    const totalXpBefore = userData?.totalXp ?? 0;
    const totalXpAfter = totalXpBefore + xpEarned;
    const leveledUp = didLevelUp(totalXpBefore, xpEarned);

    // ---- writes -----------------------------------------------------------
    transaction.set(
      sessionRef,
      toDoc({
        ...input,
        isDailyCompletion: completion.isDailyCompletion,
        streakEarned: completion.streakEarned,
        retryOfSessionId: rootId,
        attemptNumber,
        gamification: {
          xpEarned,
          totalXpAfter,
          levelAfter: getLevelFromXp(totalXpAfter),
          didLevelUp: leveledUp,
          questsCompleted: newlyCompleted.map((quest) => quest.id),
          isPersonalBest,
        },
        session: {
          ...input.session,
          streak: completion.streakEarned,
          dayNumber: completion.next.daysPracticed,
          previousScore: previousScore ?? undefined,
        },
      }),
    );

    const aggregate = buildAggregateUpdate({
      uid: input.userId,
      completion,
      challengeDate: input.challengeDate,
      existing: userData,
      isNewDocument: !userSnapshot.exists,
      overallScore,
    });
    if (xpEarned > 0) aggregate.totalXp = FieldValue.increment(xpEarned);
    if (isPersonalBest || bestBefore === null) {
      aggregate.bestOverallScore = Math.max(bestBefore ?? 0, overallScore);
    }
    transaction.set(userRef, aggregate, { merge: true });

    transaction.set(
      questRef,
      buildQuestUpdate({
        dayKey: input.challengeDate,
        questIds,
        newlyCompleted,
        sessionId: input.session.id,
        isNewDocument: !questSnapshot.exists,
      }),
      { merge: true },
    );

    for (const { event, ref } of pending) {
      transaction.set(ref, {
        type: event.type,
        amount: event.amount,
        questId: event.questId ?? null,
        sessionId: input.session.id,
        dayKey: input.challengeDate,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    return {
      sessionId: input.session.id,
      streakEarned: completion.streakEarned,
      isDailyCompletion: completion.isDailyCompletion,
      dayNumber: completion.next.daysPracticed,
      longestStreak: completion.next.longestStreak,
      previousScore: previousScore ?? undefined,
      isRetry,
      attemptNumber,
      xpEarned,
      totalXp: totalXpAfter,
      level: getLevelFromXp(totalXpAfter),
      didLevelUp: leveledUp,
      questsCompleted: newlyCompleted.map((quest) => quest.id),
      isPersonalBest,
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
