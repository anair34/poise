import {
  COMPLETENESS_TIERS,
  COMPLETE_WORD_COUNT,
  RUSHED_WPM,
  TARGET_DURATION_SECONDS,
  type CompletenessTier,
  type TierDefinition,
} from "./config.ts";

/**
 * How complete a response is, from duration and word count together.
 *
 * Duration alone is not enough. Twenty seconds of dense speech and twenty
 * seconds with long pauses are different answers, and grading them the same is
 * exactly the kind of thing that makes scores feel arbitrary.
 */

export interface CompletenessAssessment {
  tier: CompletenessTier;
  label: string;
  caps: TierDefinition["caps"];
  /** The tier duration alone would have produced, before word-count adjustment. */
  durationTier: CompletenessTier;
  /** Human-readable note on why the tier moved, if it did. */
  adjustment: string | null;
  /** True when the answer is too short to evaluate meaningfully at all. */
  isInsufficient: boolean;
  /** Speech fast enough to read as rushed rather than merely brisk. */
  isRushed: boolean;
  /** Share of the 60-second exercise actually used, 0–1. */
  durationRatio: number;
}

function tierIndexFromDuration(durationSeconds: number): number {
  let index = 0;
  for (let i = 0; i < COMPLETENESS_TIERS.length; i += 1) {
    if (durationSeconds >= COMPLETENESS_TIERS[i].minSeconds) index = i;
  }
  return index;
}

function clampIndex(index: number): number {
  return Math.min(COMPLETENESS_TIERS.length - 1, Math.max(0, index));
}

export function assessCompleteness({
  durationSeconds,
  wordCount,
  wordsPerMinute,
}: {
  durationSeconds: number;
  wordCount: number;
  wordsPerMinute: number;
}): CompletenessAssessment {
  const duration = Number.isFinite(durationSeconds)
    ? Math.max(0, durationSeconds)
    : 0;
  const words = Number.isFinite(wordCount) ? Math.max(0, wordCount) : 0;

  const baseIndex = tierIndexFromDuration(duration);
  const base = COMPLETENESS_TIERS[baseIndex];

  let index = baseIndex;
  let adjustment: string | null = null;

  if (words >= COMPLETE_WORD_COUNT && baseIndex < COMPLETENESS_TIERS.length - 1) {
    // Said enough to constitute a real answer, whatever the clock says. This is
    // what stops an efficient 35-second answer being treated as a fragment.
    index = clampIndex(baseIndex + 1);
    adjustment = `${words} words is a complete answer despite the ${Math.round(duration)}s length`;
  } else if (words < base.minWords && baseIndex > 0) {
    // Thinner than the duration implies: mostly silence rather than speech.
    index = clampIndex(baseIndex - 1);
    adjustment = `only ${words} words in ${Math.round(duration)}s`;
  }

  const tier = COMPLETENESS_TIERS[index];

  return {
    tier: tier.tier,
    label: tier.label,
    caps: tier.caps,
    durationTier: base.tier,
    adjustment,
    isInsufficient: tier.tier === "insufficient",
    isRushed: wordsPerMinute >= RUSHED_WPM,
    durationRatio:
      Math.round(Math.min(1, duration / TARGET_DURATION_SECONDS) * 100) / 100,
  };
}
