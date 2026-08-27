import { computeMetrics, computeOverallScore } from "./scoring";
import type { Prompt, ScoreNotes, Session } from "./types";

const MOCK_TRANSCRIPT =
  "So I guess the opinion I've changed my mind about is that I used to think speaking well was something you were just born with. You either had presence or you didn't, and there wasn't really much you could do about it. What changed my mind was watching a colleague of mine prepare for a big review. She wasn't naturally fluent at all. She just practiced out loud, every single day, until the shape of her thinking got clearer. And by the time she actually presented, everyone in the room thought she was a natural. So I realized the confidence I'd been envying was really just repetition that I hadn't seen.";

function clamp(value: number, min = 40, max = 96): number {
  return Math.round(Math.min(max, Math.max(min, value)));
}

function noteFor(score: number, strong: string, weak: string): string {
  return score >= 78 ? strong : weak;
}

/**
 * Deterministic placeholder analysis derived from the real recording duration,
 * so every section of the results page has realistic content to render before
 * Whisper and GPT are wired up.
 */
export function buildMockSession(
  id: string,
  prompt: Prompt,
  durationSeconds: number,
): Session {
  const metrics = computeMetrics(MOCK_TRANSCRIPT, durationSeconds);
  const wordsPerMinute = metrics.wordsPerMinute;

  // Reward using more of the minute; penalize rushing.
  const usage = Math.min(durationSeconds / 55, 1);
  const pacePenalty = Math.abs(wordsPerMinute - 145) / 6;

  const scores = {
    clarity: clamp(72 + usage * 14 - pacePenalty * 0.6),
    structure: clamp(66 + usage * 20),
    concision: clamp(88 - pacePenalty),
    delivery: clamp(70 + usage * 16 - pacePenalty * 0.4),
  };

  // The same weighting the real path uses, so mock sessions are comparable.
  const overallScore = computeOverallScore(scores);

  const scoreNotes: ScoreNotes = {
    clarity: noteFor(
      scores.clarity,
      "Your core point was easy to understand.",
      "The main idea took a few passes to surface.",
    ),
    structure: noteFor(
      scores.structure,
      "Clear beginning, middle, and landing.",
      "The turn arrived later than it needed to.",
    ),
    concision: noteFor(
      scores.concision,
      "Very little wasted language.",
      "A few sentences circled before committing.",
    ),
    delivery: noteFor(
      scores.delivery,
      "Steady pace with confident pauses.",
      "Pace drifted quickly in the middle stretch.",
    ),
  };

  const createdAt = new Date().toISOString();

  return {
    id,
    createdAt,
    challengeDate: createdAt.slice(0, 10),
    promptId: prompt.id,
    promptText: prompt.text,
    category: prompt.category,
    transcript: MOCK_TRANSCRIPT,
    overallScore,
    scores,
    scoreNotes,
    // Computed from the real mock transcript rather than hardcoded, so the mock
    // session exercises the same metric code the LLM path relies on.
    metrics,
    feedback: {
      summary: "You made your point clearly. Now let's make it sharper.",
      strength: {
        title: "Strong supporting example",
        detail:
          "You used a concrete example to explain why your opinion changed, which made the argument much easier to follow.",
      },
      opportunity: {
        title: "Get to the point sooner.",
        detail:
          "You spent the first 22 seconds framing the topic before stating your position. Lead with your conclusion, then explain why.",
      },
      rewrite:
        "I used to think presence was something you were born with. I changed my mind watching a colleague prepare — she practiced out loud every day until her thinking got clear. What I'd been calling natural talent was just repetition I hadn't seen.",
      encouragement:
        "This is the kind of answer that sharpens fast. Same shape tomorrow and you'll feel the difference.",
    },
    // Overwritten by the caller with the user's real streak state. Mock mode
    // fakes the analysis, not the streak.
    streak: 0,
    dayNumber: 1,
    scoringSource: "mock",
  };
}
