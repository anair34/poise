import "server-only";

import { FieldValue, Timestamp, type DocumentReference } from "firebase-admin/firestore";
import { userDocRef, type UserDoc } from "@/lib/users";
import { isValidDayKey } from "@/lib/streaks";
import {
  assignDailyQuestIds,
  getQuest,
  type Quest,
  type QuestEligibility,
} from "./quests";

/**
 * Daily quest state lives at `users/{uid}/dailyQuests/{YYYY-MM-DD}`.
 *
 * The *assignment* is derived (see `assignDailyQuests`), so this document does
 * not need to exist for a user to have quests today — which means reading the
 * dashboard never has to write. The document is created by the first session
 * that completes something, and from then on its stored `questIds` win. That
 * ordering is what keeps history honest if the registry is ever edited: a day
 * already played back reports the quests it was actually played with.
 */
export const DAILY_QUESTS_COLLECTION = "dailyQuests";

export interface DailyQuestDoc {
  dayKey: string;
  /** Frozen assignment. Authoritative once written. */
  questIds: string[];
  assignedAt: Timestamp;
  /** Quest ids completed today. */
  completed: string[];
  /** Per-quest metadata, keyed by quest id. */
  completions: Record<
    string,
    { completedAt: Timestamp; xpAwarded: number; sessionId: string }
  >;
}

export function dailyQuestRef(uid: string, dayKey: string): DocumentReference {
  return userDocRef(uid).collection(DAILY_QUESTS_COLLECTION).doc(dayKey);
}

/**
 * Eligibility as of the start of the day.
 *
 * Deliberately derived from `firstPracticeDate` rather than "has any session",
 * because it must not change partway through a day — if it did, a user's quests
 * could swap out after their first session of the morning.
 */
export function eligibilityFor(
  user: Partial<UserDoc> | undefined,
  dayKey: string,
): QuestEligibility {
  const first = user?.firstPracticeDate ?? null;
  return {
    hasPracticedBeforeToday: Boolean(first && first < dayKey),
  };
}

export interface DailyQuestState {
  dayKey: string;
  quests: Quest[];
  completed: string[];
  /** Convenience for the dashboard header, e.g. "1 / 2 complete". */
  completedCount: number;
  total: number;
}

function resolveQuests(ids: string[]): Quest[] {
  return ids
    .map((id) => getQuest(id))
    .filter((quest): quest is Quest => Boolean(quest));
}

/**
 * Today's quests and their completion state, for rendering.
 *
 * Read-only: if no document exists yet the assignment is derived on the fly, so
 * a user who has not practised today still sees the quests they are working
 * toward without this read causing a write.
 */
export async function getDailyQuestState(
  uid: string,
  dayKey: string,
  user: Partial<UserDoc> | undefined,
): Promise<DailyQuestState> {
  if (!uid || !isValidDayKey(dayKey)) {
    return { dayKey, quests: [], completed: [], completedCount: 0, total: 0 };
  }

  const snapshot = await dailyQuestRef(uid, dayKey).get();
  const stored = snapshot.exists
    ? (snapshot.data() as Partial<DailyQuestDoc>)
    : undefined;

  const ids =
    stored?.questIds && stored.questIds.length > 0
      ? stored.questIds
      : assignDailyQuestIds(uid, dayKey, eligibilityFor(user, dayKey));

  const quests = resolveQuests(ids);
  const completed = (stored?.completed ?? []).filter((id) => ids.includes(id));

  return {
    dayKey,
    quests,
    completed,
    completedCount: completed.length,
    total: quests.length,
  };
}

/**
 * Day keys where the user completed every quest they were assigned.
 *
 * Reads the daily documents directly rather than re-deriving assignments,
 * because only the stored document knows what was actually assigned on a past
 * day. Days never touched simply have no document and are correctly absent.
 */
export async function getPerfectQuestDays(
  uid: string,
  max = 120,
): Promise<string[]> {
  if (!uid) return [];

  const snapshot = await userDocRef(uid)
    .collection(DAILY_QUESTS_COLLECTION)
    .orderBy("dayKey", "desc")
    .limit(max)
    .get();

  return snapshot.docs
    .map((doc) => doc.data() as Partial<DailyQuestDoc>)
    .filter((data) => {
      const assigned = data.questIds ?? [];
      const completed = data.completed ?? [];
      return assigned.length > 0 && completed.length >= assigned.length;
    })
    .map((data) => data.dayKey)
    .filter((dayKey): dayKey is string => Boolean(dayKey));
}

/** The merge payload that records newly completed quests. */
export function buildQuestUpdate({
  dayKey,
  questIds,
  newlyCompleted,
  sessionId,
  isNewDocument,
}: {
  dayKey: string;
  questIds: string[];
  newlyCompleted: Quest[];
  sessionId: string;
  isNewDocument: boolean;
}): Record<string, unknown> {
  const update: Record<string, unknown> = {
    dayKey,
    // Written every time but always the same value, which is what freezes the
    // assignment on the first write of the day.
    questIds,
  };

  if (isNewDocument) {
    update.assignedAt = FieldValue.serverTimestamp();
  }

  if (newlyCompleted.length > 0) {
    update.completed = FieldValue.arrayUnion(
      ...newlyCompleted.map((quest) => quest.id),
    );
    for (const quest of newlyCompleted) {
      update[`completions.${quest.id}`] = {
        completedAt: FieldValue.serverTimestamp(),
        xpAwarded: quest.xpReward,
        sessionId,
      };
    }
  }

  return update;
}
