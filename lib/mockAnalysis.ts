import { DEMO_DAY_NUMBER, DEMO_STREAK } from "./demo";
import type { Prompt, Session } from "./types";

const MOCK_TRANSCRIPT =
  "I used to think that speaking well was something you were born with. You either had presence or you didn't. What changed my mind was watching a colleague prepare. She wasn't naturally fluent at all, she just practiced out loud, every day, until the shape of her thinking got clearer. And I realized the confidence I was envying was really just repetition.";

function clamp(value: number, min = 40, max = 96): number {
  return Math.round(Math.min(max, Math.max(min, value)));
}

/**
 * Deterministic placeholder analysis derived from the real recording duration,
 * so the results page looks alive before Whisper and GPT are wired up.
 */
export function buildMockSession(
  id: string,
  prompt: Prompt,
  durationSeconds: number,
): Session {
  const wordCount = MOCK_TRANSCRIPT.trim().split(/\s+/).length;
  const wordsPerMinute = Math.round(
    wordCount / Math.max(durationSeconds / 60, 0.15),
  );

  // Reward using more of the minute; penalize rushing.
  const usage = Math.min(durationSeconds / 55, 1);
  const pacePenalty = Math.abs(wordsPerMinute - 145) / 6;

  const scores = {
    clarity: clamp(72 + usage * 14 - pacePenalty * 0.6),
    structure: clamp(66 + usage * 20),
    concision: clamp(88 - pacePenalty),
    delivery: clamp(70 + usage * 16 - pacePenalty * 0.4),
  };

  const overallScore = clamp(
    scores.clarity * 0.3 +
      scores.structure * 0.3 +
      scores.concision * 0.2 +
      scores.delivery * 0.2,
  );

  return {
    id,
    createdAt: new Date().toISOString(),
    promptId: prompt.id,
    promptText: prompt.text,
    category: prompt.category,
    transcript: MOCK_TRANSCRIPT,
    overallScore,
    scores,
    metrics: {
      wordsPerMinute,
      fillerWordCount: 4,
      fillerWords: [
        { word: "just", count: 2 },
        { word: "really", count: 1 },
        { word: "like", count: 1 },
      ],
      durationSeconds: Math.round(durationSeconds),
      wordCount,
    },
    feedback: {
      strength:
        "You landed on a genuinely specific story instead of a general opinion, and that made the whole answer credible.",
      opportunity:
        "The turning point arrived a little late. Say what changed your mind in the first fifteen seconds, then spend the rest earning it.",
      rewrite:
        "I used to believe presence was innate — until I watched a colleague practice out loud every single day. The confidence I envied was just repetition.",
      encouragement:
        "This is the kind of answer that gets sharper fast. Same prompt shape tomorrow and you'll feel the difference.",
    },
    streak: DEMO_STREAK,
    dayNumber: DEMO_DAY_NUMBER,
  };
}
