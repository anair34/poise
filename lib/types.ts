/** Runtime list so generated prompts can be validated against it. */
export const CATEGORIES = [
  "Opinion",
  "Storytelling",
  "Persuasion",
  "Explanation",
  "Reflection",
] as const;

export type Category = (typeof CATEGORIES)[number];

export type RecorderState = "ready" | "recording" | "processing";

export interface Prompt {
  id: string;
  text: string;
  category: Category;
  coachingTip: string;
}

export interface Scores {
  clarity: number;
  structure: number;
  concision: number;
  delivery: number;
}

/**
 * Measured, not judged. Every field is computed deterministically from the
 * transcript and its duration in `lib/scoring.ts`, so the same recording always
 * produces the same numbers. These are given to the LLM as evidence and shown
 * to the user as fact.
 *
 * The rate fields are optional because sessions saved before they existed will
 * not have them.
 */
export interface SpeechMetrics {
  wordsPerMinute: number;
  fillerWordCount: number;
  fillerWords: { word: string; count: number }[];
  durationSeconds: number;
  wordCount: number;
  /** Fillers per 100 words. */
  fillerRate?: number;
  hedgeCount?: number;
  /** Hedge phrases per 100 words. */
  hedgeRate?: number;
  /** Share of three-word sequences that repeat. */
  repetitionRate?: number;
  /** Unique words over total words. */
  lexicalDiversity?: number;
}

export type ScoreKey = keyof Scores;

/** One-line read on a single dimension, shown beside its bar. */
export type ScoreNotes = Partial<Record<ScoreKey, string>>;

export interface CoachingNote {
  title: string;
  detail: string;
}

export interface Feedback {
  /** One sentence describing the session, shown under the hero heading. */
  summary: string;
  strength?: CoachingNote;
  opportunity?: CoachingNote;
  /** A stronger phrasing of the user's own answer. */
  rewrite?: string;
  encouragement?: string;
}

/**
 * Which system produced the scores on a stored session.
 *
 * Stored per session so a score can always be traced to its origin — otherwise
 * a prompt or model change makes every historical score unexplainable. Old
 * documents may carry values no longer produced, so reads tolerate any string.
 */
export type ScoringSource = "llm" | "mock";

export interface Session {
  id: string;
  createdAt: string;
  /**
   * The UTC day this session counted toward, YYYY-MM-DD. Matches the day key
   * used by streaks and the daily prompt, so the calendar and the streak can
   * never disagree about which square a session belongs in.
   */
  challengeDate: string;
  promptId: string;
  promptText: string;
  category: Category;
  transcript: string;
  overallScore: number;
  scores: Scores;
  scoreNotes?: ScoreNotes;
  metrics: SpeechMetrics;
  feedback: Feedback;
  streak: number;
  dayNumber: number;
  /** Overall score of the prior session, used for the hero delta. */
  previousScore?: number;
  /** Absent on sessions written before provenance was recorded. */
  scoringSource?: string;
}

export interface AnalyzeResponse {
  id: string;
}

export interface ApiError {
  error: string;
}
