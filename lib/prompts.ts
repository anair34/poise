import type { Prompt } from "./types";

/**
 * The static prompt library.
 *
 * Since prompts became LLM-generated per day (`lib/dailyPrompts.ts`), this is no
 * longer the source of today's challenge. It has two remaining jobs: the
 * fallback when scheduled generation has not run, and the "New prompt" option
 * for someone who wants extra practice beyond the daily one.
 */
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

export function getPromptById(id: string): Prompt | undefined {
  return PROMPTS.find((prompt) => prompt.id === id);
}

/** A library prompt by index, wrapping. Used for deterministic fallbacks. */
export function getLibraryPrompt(index: number): Prompt {
  const size = PROMPTS.length;
  return PROMPTS[((index % size) + size) % size]!;
}

/**
 * The next library prompt, so "New prompt" always changes the challenge.
 *
 * An unknown id — a generated daily prompt, say — yields the first library
 * prompt, which is the right behaviour: it is still a change.
 */
export function getNextPrompt(currentId: string): Prompt {
  const index = PROMPTS.findIndex((prompt) => prompt.id === currentId);
  return PROMPTS[(index + 1) % PROMPTS.length]!;
}
