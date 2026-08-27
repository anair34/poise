import {
  FILLER_BANDS,
  HEDGE,
  PACE_COMFORTABLE,
  PACE_FAST,
  PACE_PENALTY,
  PACE_SLOW,
  REPETITION,
  SCORE_WEIGHTS,
  SCORING_VERSION,
  type FillerBand,
  type PaceBand,
} from "./config.ts";
import { assessCompleteness, type CompletenessAssessment } from "./completeness.ts";
import type { Scores, SpeechMetrics } from "../types.ts";

/**
 * Deterministic constraints applied to the model's scores.
 *
 * The model is good at judging meaning and bad at being consistent about
 * numbers. So it proposes, and this file disposes: every score it returns is
 * passed through ceilings derived from measurements it cannot argue with.
 *
 * These are *caps*, never boosts. A constraint can say "this cannot be better
 * than 55 given the evidence"; nothing here can raise a score the model chose to
 * give, because there is no measurement that proves an answer was good.
 */

export function clampScore(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(Math.min(100, Math.max(0, numeric)));
}

/** Overall score is always computed here, never chosen by the model. */
export function computeOverallScore(scores: Scores): number {
  const weighted =
    clampScore(scores.clarity) * SCORE_WEIGHTS.clarity +
    clampScore(scores.structure) * SCORE_WEIGHTS.structure +
    clampScore(scores.concision) * SCORE_WEIGHTS.concision +
    clampScore(scores.delivery) * SCORE_WEIGHTS.delivery;
  return Math.round(weighted);
}

export function classifyPace(wordsPerMinute: number): PaceBand {
  if (wordsPerMinute < PACE_SLOW) return "very_slow";
  if (wordsPerMinute < PACE_COMFORTABLE.min) return "slow";
  if (wordsPerMinute <= PACE_COMFORTABLE.max) return "comfortable";
  if (wordsPerMinute <= PACE_FAST) return "fast";
  return "very_fast";
}

/**
 * A delivery ceiling from pace, as a slope rather than a step.
 *
 * A cliff at exactly 170 wpm would make 171 meaningfully worse than 169, which
 * is not true of speech and would make two near-identical takes score
 * differently for no reason a speaker could act on.
 */
export function paceDeliveryCap(wordsPerMinute: number): number {
  if (
    wordsPerMinute >= PACE_COMFORTABLE.min &&
    wordsPerMinute <= PACE_COMFORTABLE.max
  ) {
    return 100;
  }

  const distance =
    wordsPerMinute > PACE_COMFORTABLE.max
      ? (wordsPerMinute - PACE_COMFORTABLE.max) * PACE_PENALTY.perWpmOver
      : (PACE_COMFORTABLE.min - wordsPerMinute) * PACE_PENALTY.perWpmUnder;

  return Math.round(100 - Math.min(PACE_PENALTY.max, distance));
}

export function classifyFillers(fillerRate: number): FillerBand {
  for (const band of FILLER_BANDS) {
    if (fillerRate <= band.maxRate) return band.band;
  }
  return "heavy";
}

function fillerBandFor(fillerRate: number) {
  return (
    FILLER_BANDS.find((band) => fillerRate <= band.maxRate) ??
    FILLER_BANDS[FILLER_BANDS.length - 1]
  );
}

function repetitionConcisionCap(rate: number): number {
  if (rate >= REPETITION.extreme) return REPETITION.caps.extreme;
  if (rate >= REPETITION.heavy) return REPETITION.caps.heavy;
  if (rate >= REPETITION.noticeable) return REPETITION.caps.noticeable;
  return 100;
}

function hedgeConcisionCap(rate: number): number {
  if (rate >= HEDGE.heavy) return HEDGE.caps.heavy;
  if (rate >= HEDGE.noticeable) return HEDGE.caps.noticeable;
  return 100;
}

/** One ceiling that actually bound a score, kept for debugging. */
export interface AppliedCap {
  dimension: keyof Scores;
  cap: number;
  from: number;
  reason: string;
}

export type ScoringStatus = "scored" | "insufficient";

export interface ConstrainedScoring {
  /** Scores after every ceiling, and what the UI shows. */
  scores: Scores;
  /** Exactly what the model returned, before constraints. */
  rawScores: Scores;
  overallScore: number;
  /** Overall the raw scores would have produced. Debugging only. */
  rawOverallScore: number;
  completeness: CompletenessAssessment;
  paceBand: PaceBand;
  fillerBand: FillerBand;
  /** Only ceilings that actually bound something. */
  appliedCaps: AppliedCap[];
  status: ScoringStatus;
  scoringVersion: string;
}

/**
 * Applies every deterministic ceiling to the model's four scores.
 *
 * Order does not matter: each dimension takes the minimum of its raw score and
 * every ceiling that applies to it, so the result is the same however the
 * constraints are arranged.
 */
export function applyScoreConstraints(
  rawInput: Scores,
  metrics: SpeechMetrics,
): ConstrainedScoring {
  const rawScores: Scores = {
    clarity: clampScore(rawInput.clarity),
    structure: clampScore(rawInput.structure),
    concision: clampScore(rawInput.concision),
    delivery: clampScore(rawInput.delivery),
  };

  const fillerRate = metrics.fillerRate ?? 0;
  const hedgeRate = metrics.hedgeRate ?? 0;
  const repetitionRate = metrics.repetitionRate ?? 0;
  const wpm = metrics.wordsPerMinute ?? 0;

  const completeness = assessCompleteness({
    durationSeconds: metrics.durationSeconds,
    wordCount: metrics.wordCount,
    wordsPerMinute: wpm,
  });

  const paceBand = classifyPace(wpm);
  const fillerBand = fillerBandFor(fillerRate);

  // Every ceiling that applies, by dimension. Collected as a list so the reason
  // a score moved is recoverable later instead of being lost in a Math.min.
  const ceilings: AppliedCap[] = [];
  const consider = (
    dimension: keyof Scores,
    cap: number,
    reason: string,
  ) => {
    if (cap < 100) {
      ceilings.push({ dimension, cap, from: rawScores[dimension], reason });
    }
  };

  // Completeness constrains all four, hardest on structure: a fragment cannot
  // have an arc, however well-phrased it is.
  const completenessReason = `${completeness.label.toLowerCase()} (${metrics.durationSeconds}s, ${metrics.wordCount} words)`;
  consider("clarity", completeness.caps.clarity, completenessReason);
  consider("structure", completeness.caps.structure, completenessReason);
  consider("concision", completeness.caps.concision, completenessReason);
  consider("delivery", completeness.caps.delivery, completenessReason);

  consider("delivery", paceDeliveryCap(wpm), `pace ${wpm} wpm (${paceBand})`);

  const fillerReason = `filler rate ${fillerRate.toFixed(1)} per 100 words (${fillerBand.band})`;
  consider("delivery", fillerBand.deliveryCap, fillerReason);
  consider("concision", fillerBand.concisionCap, fillerReason);

  consider(
    "concision",
    repetitionConcisionCap(repetitionRate),
    `repetition ${Math.round(repetitionRate * 100)}% of trigrams repeat`,
  );
  consider(
    "concision",
    hedgeConcisionCap(hedgeRate),
    `hedging ${hedgeRate.toFixed(1)} per 100 words`,
  );

  // Clarity is deliberately constrained only by completeness. Mechanical
  // signals like pace and fillers describe delivery, not whether the listener
  // understood the point — capping clarity for them would score the same flaw
  // two or three times over.

  const scores: Scores = { ...rawScores };
  const appliedCaps: AppliedCap[] = [];

  for (const ceiling of ceilings) {
    if (scores[ceiling.dimension] > ceiling.cap) {
      scores[ceiling.dimension] = ceiling.cap;
    }
    // Recorded when it bound the *raw* score, which is the useful question when
    // reading back why a session scored what it did.
    if (ceiling.from > ceiling.cap) appliedCaps.push(ceiling);
  }

  return {
    scores,
    rawScores,
    overallScore: computeOverallScore(scores),
    rawOverallScore: computeOverallScore(rawScores),
    completeness,
    paceBand,
    fillerBand: fillerBand.band,
    appliedCaps,
    status: completeness.isInsufficient ? "insufficient" : "scored",
    scoringVersion: SCORING_VERSION,
  };
}

/** Shown to the user when the recording was too short to judge properly. */
export const INSUFFICIENT_NOTICE =
  "This response was too short for a full evaluation.";
