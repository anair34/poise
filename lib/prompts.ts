import type { Prompt } from "./types";

export const PROMPTS: Prompt[] = [
  {
    id: "changed-mind",
    text: "What is one opinion you've changed your mind about, and what changed it?",
    category: "Opinion",
    coachingTip: "Name the old belief plainly before you explain the shift.",
  },
  {
    id: "small-decision",
    text: "Describe a small decision that ended up shaping your life more than you expected.",
    category: "Storytelling",
    coachingTip: "Start in the moment, not with the lesson.",
  },
  {
    id: "convince-me",
    text: "Convince someone to try the thing you love most, in under a minute.",
    category: "Persuasion",
    coachingTip: "Lead with the feeling, then give one concrete reason.",
  },
  {
    id: "explain-simply",
    text: "Explain something you know well to someone who has never heard of it.",
    category: "Explanation",
    coachingTip: "Use one analogy and resist the urge to add caveats.",
  },
  {
    id: "proud-week",
    text: "What is something you did recently that you're quietly proud of?",
    category: "Reflection",
    coachingTip: "Be specific about what made it hard.",
  },
];

/** Deterministic prompt-of-the-day so every visitor sees the same challenge. */
export function getDailyPrompt(date = new Date()): Prompt {
  const daysSinceEpoch = Math.floor(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) /
      86_400_000,
  );
  return PROMPTS[daysSinceEpoch % PROMPTS.length];
}

export function getPromptById(id: string): Prompt | undefined {
  return PROMPTS.find((prompt) => prompt.id === id);
}
