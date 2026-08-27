/**
 * XP awards, as idempotent events.
 *
 * Every award is an event with a deterministic id. The id is what prevents
 * farming and double-awards: writing an event is conditional on that id not
 * already existing, so a retried request, a double-submit, or two concurrent
 * uploads can all try to award the same thing and only one will land.
 *
 * The ids are also why most awards are keyed by *day* rather than by session.
 * "Completed a retry" keyed by session would pay out on every retry forever;
 * keyed by day it pays once, and the second retry that day is still worth doing
 * because quests and personal bests remain in play.
 */

import type { Quest } from "./quests";

export type XpEventType =
  | "daily_challenge"
  | "first_retry"
  | "retry_improved"
  | "personal_best"
  | "quest";

export const XP_REWARDS = {
  /** Completing the day's challenge for the first time. */
  daily_challenge: 20,
  /** The first retry of the day, improved or not. Rewards the attempt. */
  first_retry: 10,
  /** A retry that actually beat the score it was measured against. */
  retry_improved: 10,
  /** A new all-time high overall score. */
  personal_best: 10,
  /** Per quest completed. Mirrors QUEST_XP. */
  quest: 15,
} as const satisfies Record<XpEventType, number>;

export interface XpEvent {
  /** Deterministic. Doubles as the Firestore document id. */
  id: string;
  type: XpEventType;
  amount: number;
  /** Present for quest awards. */
  questId?: string;
}

export interface XpEventInput {
  dayKey: string;
  sessionId: string;
  isDailyCompletion: boolean;
  isRetry: boolean;
  /** True when a retry beat the score it was measured against. */
  retryImproved: boolean;
  isPersonalBest: boolean;
  questsCompleted: Quest[];
}

/**
 * The XP events a session is *eligible* for.
 *
 * "Eligible", not "awarded" — the caller still has to check which ids already
 * exist. Keeping that split means this stays pure and the dedupe lives next to
 * the write that depends on it.
 */
export function buildXpEvents(input: XpEventInput): XpEvent[] {
  const events: XpEvent[] = [];

  if (input.isDailyCompletion) {
    events.push({
      id: `daily_challenge:${input.dayKey}`,
      type: "daily_challenge",
      amount: XP_REWARDS.daily_challenge,
    });
  }

  if (input.isRetry) {
    events.push({
      id: `first_retry:${input.dayKey}`,
      type: "first_retry",
      amount: XP_REWARDS.first_retry,
    });

    if (input.retryImproved) {
      events.push({
        id: `retry_improved:${input.dayKey}`,
        type: "retry_improved",
        amount: XP_REWARDS.retry_improved,
      });
    }
  }

  if (input.isPersonalBest) {
    // Keyed by session rather than day: a personal best must beat every
    // previous score, so it cannot be repeated without genuinely improving.
    events.push({
      id: `personal_best:${input.sessionId}`,
      type: "personal_best",
      amount: XP_REWARDS.personal_best,
    });
  }

  for (const quest of input.questsCompleted) {
    events.push({
      id: `quest:${input.dayKey}:${quest.id}`,
      type: "quest",
      amount: quest.xpReward,
      questId: quest.id,
    });
  }

  return events;
}

export function sumXp(events: XpEvent[]): number {
  return events.reduce((total, event) => total + event.amount, 0);
}
