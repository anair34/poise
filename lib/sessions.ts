import "server-only";

import { Timestamp } from "firebase-admin/firestore";
import { getDb } from "./firebase/admin";
import type { Category, ScoringSource, Session } from "./types";

export const SESSIONS_COLLECTION = "practiceSessions";

/** Flat Firestore document shape. Kept flat so it stays queryable. */
export interface SessionDoc {
  id: string;
  userId: string;
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
  dayKey: string;
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

  streak: number;
  dayNumber: number;
}

export interface CreateSessionInput {
  session: Session;
  /** Required: every session belongs to exactly one signed-in user. */
  userId: string;
  dayKey: string;
  scoringSource?: ScoringSource;
  modelVersion?: string;
}

function toDoc({
  session,
  userId,
  dayKey,
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
    dayKey,
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

    streak: session.streak,
    dayNumber: session.dayNumber,
  };
}

function fromDoc(doc: SessionDoc): Session {
  return {
    id: doc.id,
    createdAt:
      doc.createdAt instanceof Timestamp
        ? doc.createdAt.toDate().toISOString()
        : new Date().toISOString(),
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
    streak: doc.streak,
    dayNumber: doc.dayNumber,
    scoringSource: doc.scoringSource ?? undefined,
  };
}

function collection() {
  return getDb().collection(SESSIONS_COLLECTION);
}

export async function createSession(input: CreateSessionInput): Promise<string> {
  const doc = toDoc(input);
  // Document id mirrors session id so /results/[id] is a direct lookup.
  await collection().doc(doc.id).set(doc);
  return doc.id;
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

export async function getRecentSessionsForUser(
  userId: string,
  max = 30,
): Promise<Session[]> {
  if (!userId) return [];
  const snapshot = await collection()
    .where("userId", "==", userId)
    .orderBy("createdAt", "desc")
    .limit(max)
    .get();
  return snapshot.docs.map((doc) => fromDoc(doc.data() as SessionDoc));
}

export async function getSessionsForDateRange(
  userId: string,
  start: Date,
  end: Date,
): Promise<Session[]> {
  if (!userId) return [];
  const snapshot = await collection()
    .where("userId", "==", userId)
    .where("createdAt", ">=", Timestamp.fromDate(start))
    .where("createdAt", "<=", Timestamp.fromDate(end))
    .orderBy("createdAt", "asc")
    .get();
  return snapshot.docs.map((doc) => fromDoc(doc.data() as SessionDoc));
}
