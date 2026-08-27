import "server-only";

/**
 * How a session gets scored.
 *
 * `mock` exists so the UI and the recording loop can be developed without
 * spending API credit. It is an explicit opt-in, never a fallback: silently
 * degrading to canned scores in production would show a user fabricated
 * feedback about a real recording.
 */
export type ScoringMode = "llm" | "mock";

export const DEFAULT_SCORING_MODE: ScoringMode = "llm";

export function getScoringMode(): ScoringMode {
  const raw = process.env.POISE_SCORING_MODE?.trim().toLowerCase();

  if (raw === "llm" || raw === "mock") return raw;

  // Predates POISE_SCORING_MODE; honored so existing .env.local files keep
  // working.
  if (process.env.POISE_USE_MOCK_ANALYSIS === "true") return "mock";

  if (raw) {
    console.warn(
      `[scoring] unknown POISE_SCORING_MODE "${raw}", falling back to "${DEFAULT_SCORING_MODE}"`,
    );
  }
  return DEFAULT_SCORING_MODE;
}
