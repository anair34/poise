import "server-only";

import { Timestamp } from "firebase-admin/firestore";
import { getDb } from "./firebase/admin";
import { ANALYSIS_MODEL, generateDailyPrompt } from "./openai";
import { PROMPTS, getLibraryPrompt, getPromptById } from "./prompts";
import { isValidDayKey, toDayKey } from "./streaks";
import { CATEGORIES, type Category, type Prompt } from "./types";

export const DAILY_PROMPTS_COLLECTION = "dailyPrompts";

/** Where a stored daily prompt came from. */
export type PromptSource = "llm" | "library";

export interface DailyPromptDoc {
  dayKey: string;
  promptId: string;
  text: string;
  category: Category;
  coachingTip: string;
  source: PromptSource;
  model: string | null;
  createdAt: Timestamp;
}

/** Prompt ids for generated days are derived from the day, so they are stable. */
export function dailyPromptId(dayKey: string): string {
  return `daily-${dayKey}`;
}

export function isDailyPromptId(id: string): boolean {
  return id.startsWith("daily-") && isValidDayKey(id.slice("daily-".length));
}

function collection() {
  return getDb().collection(DAILY_PROMPTS_COLLECTION);
}

function toPrompt(doc: DailyPromptDoc): Prompt {
  return {
    id: doc.promptId,
    text: doc.text,
    category: doc.category,
    coachingTip: doc.coachingTip,
  };
}

function isCategory(value: unknown): value is Category {
  return CATEGORIES.includes(value as Category);
}

/**
 * The library prompt for a given day.
 *
 * Deterministic in the day key, so the fallback for a particular date is always
 * the same prompt no matter when or how often it is computed.
 */
function libraryFallback(dayKey: string): Prompt {
  const index = Math.abs(
    Math.round(new Date(`${dayKey}T00:00:00.000Z`).getTime() / 86_400_000),
  );
  return PROMPTS[index % PROMPTS.length]!;
}

function docFor(
  dayKey: string,
  prompt: { text: string; category: Category; coachingTip: string },
  source: PromptSource,
): DailyPromptDoc {
  return {
    dayKey,
    promptId: dailyPromptId(dayKey),
    text: prompt.text,
    category: prompt.category,
    coachingTip: prompt.coachingTip,
    source,
    model: source === "llm" ? ANALYSIS_MODEL : null,
    createdAt: Timestamp.now(),
  };
}

/**
 * Writes a day's prompt only if that day has none.
 *
 * The create-if-absent transaction is what makes generation idempotent. A cron
 * retry, two overlapping requests, or a manual backfill all converge on one
 * prompt per day — without it, a user could load the practice page and see the
 * challenge change under them mid-session.
 *
 * Returns the prompt now stored for that day, which may be one someone else
 * wrote first.
 */
async function claimDay(
  dayKey: string,
  candidate: { text: string; category: Category; coachingTip: string },
  source: PromptSource,
): Promise<{ prompt: Prompt; created: boolean }> {
  const db = getDb();
  const ref = collection().doc(dayKey);

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (snapshot.exists) {
      return {
        prompt: toPrompt(snapshot.data() as DailyPromptDoc),
        created: false,
      };
    }

    const doc = docFor(dayKey, candidate, source);
    transaction.set(ref, doc);
    return { prompt: toPrompt(doc), created: true };
  });
}

/**
 * The prompt for a day, as shown to users.
 *
 * Never calls the model. If the scheduled generation has not run for this day,
 * the deterministic library prompt is stored instead and becomes that day's
 * challenge. This keeps the practice page fast and keeps a cron outage
 * invisible, at the cost of a repeat from the library.
 */
export async function getDailyPromptForDay(
  dayKey: string = toDayKey(),
): Promise<Prompt> {
  const snapshot = await collection().doc(dayKey).get();
  if (snapshot.exists) {
    return toPrompt(snapshot.data() as DailyPromptDoc);
  }

  const fallback = libraryFallback(dayKey);
  const { prompt } = await claimDay(
    dayKey,
    {
      text: fallback.text,
      category: fallback.category,
      coachingTip: fallback.coachingTip,
    },
    "library",
  );
  return prompt;
}

/** Recent prompt texts, newest first, used to stop the model repeating itself. */
export async function getRecentPromptTexts(limit = 40): Promise<string[]> {
  const snapshot = await collection()
    .orderBy("dayKey", "desc")
    .limit(limit)
    .get();
  return snapshot.docs.map((doc) => (doc.data() as DailyPromptDoc).text);
}

export interface GenerationResult {
  dayKey: string;
  prompt: Prompt;
  /** False when the day already had a prompt and generation was skipped. */
  created: boolean;
  source: PromptSource;
}

/**
 * Generates and stores the prompt for a day. Intended for the cron route.
 *
 * Checks for an existing prompt before spending a model call, then claims the
 * day transactionally. A generation failure falls back to the library rather
 * than leaving the day empty.
 */
export async function generatePromptForDay(
  dayKey: string,
  { preferredCategory }: { preferredCategory?: Category } = {},
): Promise<GenerationResult> {
  const existing = await collection().doc(dayKey).get();
  if (existing.exists) {
    const doc = existing.data() as DailyPromptDoc;
    return {
      dayKey,
      prompt: toPrompt(doc),
      created: false,
      source: doc.source ?? "library",
    };
  }

  const avoid = await getRecentPromptTexts();
  // Library prompts are part of the rotation, so the model should avoid echoing
  // those too.
  const avoidAll = [...avoid, ...PROMPTS.map((prompt) => prompt.text)];

  try {
    const generated = await generateDailyPrompt({
      avoid: avoidAll,
      preferredCategory,
    });
    const category = isCategory(generated.category)
      ? generated.category
      : "Reflection";

    const { prompt, created } = await claimDay(
      dayKey,
      { ...generated, category },
      "llm",
    );
    return { dayKey, prompt, created, source: created ? "llm" : "library" };
  } catch (caught) {
    console.error(
      `[prompts] generation failed for ${dayKey}, using library:`,
      caught instanceof Error ? caught.message : caught,
    );
    const fallback = libraryFallback(dayKey);
    const { prompt, created } = await claimDay(
      dayKey,
      {
        text: fallback.text,
        category: fallback.category,
        coachingTip: fallback.coachingTip,
      },
      "library",
    );
    return { dayKey, prompt, created, source: "library" };
  }
}

/**
 * Resolves any prompt id, whether from the static library or a generated day.
 *
 * Results pages outlive the day they were created, so an id must stay
 * resolvable long after that prompt stopped being today's challenge.
 */
export async function resolvePromptById(
  id: string,
): Promise<Prompt | undefined> {
  const fromLibrary = getPromptById(id);
  if (fromLibrary) return fromLibrary;

  if (!isDailyPromptId(id)) return undefined;

  const dayKey = id.slice("daily-".length);
  const snapshot = await collection().doc(dayKey).get();
  if (!snapshot.exists) return undefined;
  return toPrompt(snapshot.data() as DailyPromptDoc);
}

/** Re-exported so callers need only one import for prompt lookups. */
export { getLibraryPrompt };
