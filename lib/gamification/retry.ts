/**
 * Comparing a retry against the attempt it was measured against.
 *
 * Pure, and deliberately opinionated about which direction is "better" for each
 * measurement. Scores and filler counts have an obvious direction. Words per
 * minute does not — faster is not better and neither is slower — so it is
 * reported as a change with no verdict attached.
 */

/**
 * Deliberately dependency-free so the check script can run it under plain node.
 * The shape below is the part of `Session` this file actually reads.
 */
export interface ComparableSession {
  overallScore: number;
  scores?: {
    clarity: number;
    structure: number;
    concision: number;
    delivery: number;
  };
  metrics?: {
    wordsPerMinute?: number;
    fillerWordCount?: number;
    fillerRate?: number;
    repetitionRate?: number;
  };
}

/** Mirrors `safeScore` in lib/results, kept local to avoid a module dependency. */
function safeScore(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(Math.min(100, Math.max(0, numeric)));
}

export type Direction = "up" | "down" | "flat";

export interface ComparisonRow {
  label: string;
  before: number;
  after: number;
  delta: number;
  direction: Direction;
  /**
   * Whether the change is an improvement. Null means the measurement has no
   * inherent better direction and should be shown without a verdict.
   */
  improved: boolean | null;
  /** Formatted for display, e.g. "6.1" or "11%". */
  format?: "integer" | "decimal" | "percent" | "duration";
}

function directionOf(delta: number): Direction {
  if (delta > 0) return "up";
  if (delta < 0) return "down";
  return "flat";
}

function row(
  label: string,
  before: number,
  after: number,
  betterWhen: "higher" | "lower" | "neither",
  format: ComparisonRow["format"] = "integer",
): ComparisonRow {
  const delta = after - before;
  const direction = directionOf(delta);

  let improved: boolean | null = null;
  if (betterWhen === "higher") improved = delta > 0;
  else if (betterWhen === "lower") improved = delta < 0;

  return { label, before, after, delta, direction, improved, format };
}

export interface RetryComparison {
  /** Overall score first, then the four dimensions. */
  scores: ComparisonRow[];
  /** Deterministic measurements. */
  metrics: ComparisonRow[];
  overallDelta: number;
  /** True when the retry beat the original overall score. */
  beatOriginal: boolean;
  /** The dimension that improved most, if any did. */
  biggestImprovement: ComparisonRow | null;
  /** Fillers removed. Negative when the retry used more. */
  fillerReduction: number;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function buildRetryComparison(
  before: ComparableSession,
  after: ComparableSession,
): RetryComparison {
  const scores: ComparisonRow[] = [
    row("Overall", safeScore(before.overallScore), safeScore(after.overallScore), "higher"),
    row("Clarity", safeScore(before.scores?.clarity), safeScore(after.scores?.clarity), "higher"),
    row("Structure", safeScore(before.scores?.structure), safeScore(after.scores?.structure), "higher"),
    row("Concision", safeScore(before.scores?.concision), safeScore(after.scores?.concision), "higher"),
    row("Delivery", safeScore(before.scores?.delivery), safeScore(after.scores?.delivery), "higher"),
  ];

  const metrics: ComparisonRow[] = [
    row(
      "Fillers",
      Math.max(0, Math.round(before.metrics?.fillerWordCount ?? 0)),
      Math.max(0, Math.round(after.metrics?.fillerWordCount ?? 0)),
      "lower",
    ),
  ];

  // Optional measurements: only compare when both attempts actually carry them,
  // since sessions recorded before these existed would otherwise read as a
  // dramatic improvement from zero.
  if (
    typeof before.metrics?.fillerRate === "number" &&
    typeof after.metrics?.fillerRate === "number"
  ) {
    metrics.push(
      row(
        "Filler rate",
        round1(before.metrics.fillerRate),
        round1(after.metrics.fillerRate),
        "lower",
        "decimal",
      ),
    );
  }

  if (
    typeof before.metrics?.repetitionRate === "number" &&
    typeof after.metrics?.repetitionRate === "number"
  ) {
    metrics.push(
      row(
        "Repetition",
        Math.round(before.metrics.repetitionRate * 100),
        Math.round(after.metrics.repetitionRate * 100),
        "lower",
        "percent",
      ),
    );
  }

  metrics.push(
    row(
      "Pace",
      Math.round(before.metrics?.wordsPerMinute ?? 0),
      Math.round(after.metrics?.wordsPerMinute ?? 0),
      // Faster is not better and slower is not better. Shown, not judged.
      "neither",
    ),
  );

  const overall = scores[0];
  const dimensions = scores.slice(1);
  const bestGain = dimensions
    .filter((entry) => entry.delta > 0)
    .sort((a, b) => b.delta - a.delta)[0];

  return {
    scores,
    metrics,
    overallDelta: overall.delta,
    beatOriginal: overall.delta > 0,
    biggestImprovement: bestGain ?? null,
    fillerReduction: metrics[0].before - metrics[0].after,
  };
}

/**
 * Headline copy for a retry result.
 *
 * A worse retry is a normal part of practising and must not be framed as
 * failure — the user still did the work, and the honest read is that this take
 * did not land, not that they got worse.
 */
export function retryHeadline(comparison: RetryComparison): string {
  if (comparison.overallDelta > 0) {
    return `You beat it by ${comparison.overallDelta}.`;
  }
  if (comparison.overallDelta === 0) {
    return "Dead even with your last take.";
  }
  if (comparison.fillerReduction > 0) {
    return "Not your best score — but a cleaner take.";
  }
  return "This one didn't land. That happens.";
}
