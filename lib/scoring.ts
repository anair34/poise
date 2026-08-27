import type { Scores, SpeechMetrics } from "./types";

/**
 * Filler phrases, each matched on word boundaries so tokens inside unrelated
 * words never count ("like" must not fire on "likely" or "unlike").
 */
const FILLER_PATTERNS: { label: string; pattern: RegExp }[] = [
  { label: "um", pattern: /\bu+m+\b/gi },
  { label: "uh", pattern: /\bu+h+\b/gi },
  { label: "erm", pattern: /\be+r+m+\b/gi },
  { label: "you know", pattern: /\byou know\b/gi },
  { label: "I mean", pattern: /\bi mean\b/gi },
  { label: "basically", pattern: /\bbasically\b/gi },
  { label: "actually", pattern: /\bactually\b/gi },
  { label: "literally", pattern: /\bliterally\b/gi },
  { label: "sort of", pattern: /\bsort of\b/gi },
  { label: "kind of", pattern: /\bkind of\b/gi },
  // "like" is only a filler when it isn't the verb or a comparison. Excluding a
  // preceding subject pronoun or "just"/"more" removes the common false hits
  // ("I like it", "looks more like").
  {
    label: "like",
    pattern: /(?<!\b(?:i|we|you|they|he|she|it|who|just|more|less|much|feels?|felt|look|looks|looked|sound|sounds|sounded|seem|seems|seemed)\s)\blike\b/gi,
  },
];

/**
 * Hedges soften a claim. A few are normal; a high rate reads as uncertainty and
 * is one of the most actionable things a speaker can hear about.
 */
const HEDGE_PATTERNS: RegExp[] = [
  /\bmaybe\b/gi,
  /\bperhaps\b/gi,
  /\bprobably\b/gi,
  /\bpossibly\b/gi,
  /\bi think\b/gi,
  /\bi guess\b/gi,
  /\bi feel like\b/gi,
  /\bi believe\b/gi,
  /\bsort of\b/gi,
  /\bkind of\b/gi,
  /\ba little bit\b/gi,
  /\bnot really sure\b/gi,
  /\bi'?m not sure\b/gi,
  /\bit seems\b/gi,
];

export interface FillerResult {
  total: number;
  breakdown: { word: string; count: number }[];
}

export function countHedges(transcript: string): number {
  let total = 0;
  for (const pattern of HEDGE_PATTERNS) {
    // Fresh regex per call so the global lastIndex never leaks between runs.
    const matches = transcript.match(new RegExp(pattern.source, pattern.flags));
    total += matches?.length ?? 0;
  }
  return total;
}

function tokenize(transcript: string): string[] {
  return transcript
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Share of unique words. Low diversity usually means the same few words are
 * carrying the whole answer.
 */
export function computeLexicalDiversity(transcript: string): number {
  const tokens = tokenize(transcript);
  if (tokens.length === 0) return 0;
  return round(new Set(tokens).size / tokens.length, 4);
}

/**
 * Share of three-word sequences that appear more than once.
 *
 * Trigrams rather than single words because repeated words are normal ("the",
 * "and") while a repeated phrase is what a listener actually notices as
 * circling back over the same ground.
 */
export function computeRepetitionRate(transcript: string): number {
  const tokens = tokenize(transcript);
  if (tokens.length < 3) return 0;

  const counts = new Map<string, number>();
  for (let index = 0; index + 3 <= tokens.length; index += 1) {
    const trigram = tokens.slice(index, index + 3).join(" ");
    counts.set(trigram, (counts.get(trigram) ?? 0) + 1);
  }

  let repeated = 0;
  for (const count of counts.values()) {
    if (count > 1) repeated += count;
  }
  return round(repeated / (tokens.length - 2), 4);
}

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

/** Per 100 words, so the rate is comparable across responses of any length. */
function ratePer100Words(count: number, wordCount: number): number {
  if (wordCount <= 0) return 0;
  return round((count / wordCount) * 100, 2);
}

export function countFillers(transcript: string): FillerResult {
  const breakdown: { word: string; count: number }[] = [];
  let total = 0;

  for (const { label, pattern } of FILLER_PATTERNS) {
    // Fresh regex per call so the global lastIndex never leaks between runs.
    const matches = transcript.match(new RegExp(pattern.source, pattern.flags));
    const count = matches?.length ?? 0;
    if (count > 0) {
      breakdown.push({ word: label, count });
      total += count;
    }
  }

  breakdown.sort((a, b) => b.count - a.count);
  return { total, breakdown };
}

export function countWords(transcript: string): number {
  const trimmed = transcript.trim();
  if (!trimmed) return 0;
  // Ignore standalone punctuation tokens the transcriber may emit.
  return trimmed.split(/\s+/).filter((token) => /[\p{L}\p{N}]/u.test(token))
    .length;
}

export function computeWordsPerMinute(
  wordCount: number,
  durationSeconds: number,
): number {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return 0;
  return Math.round(wordCount / (durationSeconds / 60));
}

export function computeMetrics(
  transcript: string,
  durationSeconds: number,
): SpeechMetrics {
  const wordCount = countWords(transcript);
  const fillers = countFillers(transcript);
  const hedgeCount = countHedges(transcript);

  return {
    wordCount,
    durationSeconds: Math.round(durationSeconds),
    wordsPerMinute: computeWordsPerMinute(wordCount, durationSeconds),
    fillerWordCount: fillers.total,
    fillerWords: fillers.breakdown,
    fillerRate: ratePer100Words(fillers.total, wordCount),
    hedgeCount,
    hedgeRate: ratePer100Words(hedgeCount, wordCount),
    repetitionRate: computeRepetitionRate(transcript),
    lexicalDiversity: computeLexicalDiversity(transcript),
  };
}

const WEIGHTS: Record<keyof Scores, number> = {
  clarity: 0.3,
  structure: 0.25,
  concision: 0.25,
  delivery: 0.2,
};

export function clampScore(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(Math.min(100, Math.max(0, numeric)));
}

/** Overall score is always computed here, never chosen by the model. */
export function computeOverallScore(scores: Scores): number {
  const weighted =
    clampScore(scores.clarity) * WEIGHTS.clarity +
    clampScore(scores.structure) * WEIGHTS.structure +
    clampScore(scores.concision) * WEIGHTS.concision +
    clampScore(scores.delivery) * WEIGHTS.delivery;
  return Math.round(weighted);
}

/** A transcript this thin means we didn't capture usable speech. */
export function isTranscriptUsable(transcript: string): boolean {
  return countWords(transcript) >= 8;
}
