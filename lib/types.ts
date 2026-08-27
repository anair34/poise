export type Category =
  | "Opinion"
  | "Storytelling"
  | "Persuasion"
  | "Explanation"
  | "Reflection";

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

export interface SpeechMetrics {
  wordsPerMinute: number;
  fillerWordCount: number;
  fillerWords: { word: string; count: number }[];
  durationSeconds: number;
  wordCount: number;
}

export interface Feedback {
  strength: string;
  opportunity: string;
  rewrite: string;
  encouragement: string;
}

export interface Session {
  id: string;
  createdAt: string;
  promptId: string;
  promptText: string;
  category: Category;
  transcript: string;
  overallScore: number;
  scores: Scores;
  metrics: SpeechMetrics;
  feedback: Feedback;
  streak: number;
  dayNumber: number;
}

export interface AnalyzeResponse {
  id: string;
}

export interface ApiError {
  error: string;
}
