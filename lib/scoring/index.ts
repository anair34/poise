/**
 * Poise scoring.
 *
 * Three stages, in order:
 *
 *   1. `metrics.ts`      deterministic measurements of the transcript
 *   2. the LLM           semantic judgement of the four dimensions
 *   3. `constraints.ts`  deterministic ceilings, then the weighted overall
 *
 * The model never supplies the overall score and never has the last word on a
 * dimension. Everything it proposes is bounded by measurements it cannot argue
 * with, which is what makes the result explainable and hard to game.
 *
 * `config.ts` holds every threshold. It is the file to edit when scoring feels
 * wrong; nothing else should contain a magic number.
 */

export * from "./config.ts";
export * from "./metrics.ts";
export * from "./completeness.ts";
export * from "./constraints.ts";
