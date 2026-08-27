/**
 * Every scoring threshold in Poise, in one place.
 *
 * These numbers decide what a score means, so scattering them through the API
 * route or the prompt would make the system impossible to reason about or
 * recalibrate. Nothing here imports anything: it is data, and it is the file to
 * edit when scoring feels wrong.
 *
 * The exercise is a 60-second spoken answer. Almost every threshold below is
 * relative to that, so changing the exercise length means revisiting this file.
 */

/**
 * Bumped when the meaning of a score changes.
 *
 * Persisted on every session. Without it, a recalibration silently makes old
 * and new scores incomparable while both still look like "a 74".
 */
export const SCORING_VERSION = "v2";

export const TARGET_DURATION_SECONDS = 60;

/** Overall is a weighted blend of the four dimensions, computed by the app. */
export const SCORE_WEIGHTS = {
  clarity: 0.3,
  structure: 0.25,
  concision: 0.25,
  delivery: 0.2,
} as const;

// ---------------------------------------------------------------------------
// Completeness
// ---------------------------------------------------------------------------

export type CompletenessTier =
  | "insufficient"
  | "severely_incomplete"
  | "substantially_incomplete"
  | "partial"
  | "complete";

export interface TierDefinition {
  tier: CompletenessTier;
  /** Inclusive lower bound in seconds. */
  minSeconds: number;
  /**
   * Below this word count the answer is thinner than its duration suggests —
   * long pauses rather than sustained speech — and drops a tier.
   */
  minWords: number;
  label: string;
  /**
   * Per-dimension ceilings. Clarity is capped most gently on purpose: a short
   * answer can still be perfectly understandable, and punishing clarity for
   * brevity would be measuring the same thing twice. Structure is capped
   * hardest, because a fragment genuinely cannot have an arc.
   */
  caps: {
    clarity: number;
    structure: number;
    concision: number;
    delivery: number;
  };
}

/**
 * Ordered from most to least severe.
 *
 * The caps are chosen so the weighted overall lands somewhere defensible for a
 * best-case answer at that length — roughly 26, 41, 60, 77, and uncapped. The
 * bug that motivated this work was a ~10s answer scoring above 50; under these
 * ceilings the same answer cannot exceed 41.
 */
export const COMPLETENESS_TIERS: TierDefinition[] = [
  {
    tier: "insufficient",
    minSeconds: 0,
    minWords: 0,
    label: "Insufficient response",
    caps: { clarity: 35, structure: 15, concision: 25, delivery: 25 },
  },
  {
    tier: "severely_incomplete",
    minSeconds: 8,
    minWords: 12,
    label: "Severely incomplete",
    caps: { clarity: 50, structure: 30, concision: 40, delivery: 40 },
  },
  {
    tier: "substantially_incomplete",
    minSeconds: 15,
    minWords: 22,
    label: "Substantially incomplete",
    caps: { clarity: 68, structure: 52, concision: 58, delivery: 62 },
  },
  {
    tier: "partial",
    minSeconds: 25,
    minWords: 38,
    label: "Partial response",
    caps: { clarity: 82, structure: 70, concision: 74, delivery: 82 },
  },
  {
    tier: "complete",
    minSeconds: 40,
    minWords: 60,
    label: "Complete response",
    caps: { clarity: 100, structure: 100, concision: 100, delivery: 100 },
  },
];

/**
 * A word count that earns a tier upgrade regardless of duration.
 *
 * This is what keeps "concise but complete" from being punished. Someone who
 * makes a full argument in 35 seconds has said as much as a slower speaker says
 * in 55, and the system should not treat efficiency as an incomplete answer.
 */
export const COMPLETE_WORD_COUNT = 85;

/** Under this, there is not enough speech to evaluate at all. */
export const USABLE_WORD_COUNT = 8;

// ---------------------------------------------------------------------------
// Pace
// ---------------------------------------------------------------------------

export type PaceBand =
  | "very_slow"
  | "slow"
  | "comfortable"
  | "fast"
  | "very_fast";

/**
 * The band where pace costs nothing.
 *
 * Wide on purpose. There is no single correct speaking rate, and a narrow ideal
 * would penalise natural variation rather than genuine problems.
 */
export const PACE_COMFORTABLE = { min: 110, max: 170 } as const;
export const PACE_SLOW = 80;
export const PACE_FAST = 190;

/**
 * Delivery penalty per word-per-minute outside the comfortable band, and the
 * most it can ever cost.
 *
 * Applied as a slope rather than a step so that 171 wpm is not meaningfully
 * worse than 169 — a cliff there would be arbitrary and would make scores jump
 * on re-recordings that were essentially identical.
 */
export const PACE_PENALTY = {
  perWpmOver: 0.55,
  perWpmUnder: 0.5,
  max: 32,
} as const;

/** Beyond this, speech is rushed enough to be worth naming explicitly. */
export const RUSHED_WPM = 200;

// ---------------------------------------------------------------------------
// Fillers
// ---------------------------------------------------------------------------

export type FillerBand =
  | "excellent"
  | "strong"
  | "noticeable"
  | "distracting"
  | "heavy";

/**
 * Bands on filler *rate* per 100 words, not the raw count.
 *
 * A count punishes long answers for being long: six fillers in 200 words is
 * clean speech, while six in 40 words is not.
 */
export const FILLER_BANDS: {
  band: FillerBand;
  maxRate: number;
  deliveryCap: number;
  concisionCap: number;
}[] = [
  { band: "excellent", maxRate: 2, deliveryCap: 100, concisionCap: 100 },
  { band: "strong", maxRate: 5, deliveryCap: 100, concisionCap: 100 },
  { band: "noticeable", maxRate: 8, deliveryCap: 82, concisionCap: 100 },
  { band: "distracting", maxRate: 12, deliveryCap: 70, concisionCap: 78 },
  { band: "heavy", maxRate: Infinity, deliveryCap: 55, concisionCap: 65 },
];

// ---------------------------------------------------------------------------
// Repetition and hedging
// ---------------------------------------------------------------------------

/**
 * Share of three-word sequences that repeat.
 *
 * Some repetition is normal and even deliberate. These thresholds are set where
 * a listener would start to feel the speaker circling the same ground.
 */
export const REPETITION = {
  noticeable: 0.2,
  heavy: 0.32,
  extreme: 0.45,
  caps: { noticeable: 82, heavy: 65, extreme: 50 },
} as const;

/** Hedge phrases per 100 words. */
export const HEDGE = {
  noticeable: 6,
  heavy: 10,
  caps: { noticeable: 88, heavy: 76 },
} as const;

// ---------------------------------------------------------------------------
// LLM rubric bands
// ---------------------------------------------------------------------------

/**
 * The anchored bands handed to the model.
 *
 * Without explicit anchors the model clusters almost everything in the 70s,
 * which makes every score look the same and makes improvement invisible.
 */
export const SCORE_BANDS: { range: string; meaning: string }[] = [
  { range: "90-100", meaning: "exceptional" },
  { range: "80-89", meaning: "strong" },
  { range: "70-79", meaning: "good, with noticeable weaknesses" },
  { range: "60-69", meaning: "functional but inconsistent" },
  { range: "50-59", meaning: "weak" },
  { range: "40-49", meaning: "significant problems" },
  { range: "20-39", meaning: "very poor or severely incomplete" },
  { range: "0-19", meaning: "minimal or unusable response" },
];
