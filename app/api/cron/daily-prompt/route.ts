import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { generatePromptForDay } from "@/lib/dailyPrompts";
import { isOpenAIConfigured } from "@/lib/openai";
import { isValidDayKey, shiftDayKey, toDayKey } from "@/lib/streaks";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Scheduled prompt generation.
 *
 * Writes today's and tomorrow's prompts. Generating a day ahead is the point:
 * if this run fails, tomorrow is already written, so a single bad night never
 * reaches users. Both writes are create-if-absent, so re-running is harmless.
 */

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;

  // Vercel signs its own cron invocations with this header. In production we
  // still require the shared secret, so a missing CRON_SECRET fails closed
  // rather than leaving the route open to anyone who finds the URL.
  if (!secret) return false;

  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function run(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  if (!isOpenAIConfigured()) {
    // Not fatal: the days still get library prompts, which is a degraded but
    // working state worth reporting rather than hiding.
    console.warn("[cron] OpenAI not configured; days will use library prompts");
  }

  // ?day=YYYY-MM-DD backfills a specific date, for manual repair.
  const requested = new URL(request.url).searchParams.get("day");
  const today = toDayKey();
  const days =
    requested && isValidDayKey(requested)
      ? [requested]
      : [today, shiftDayKey(today, 1)];

  const results = [];
  for (const dayKey of days) {
    try {
      const result = await generatePromptForDay(dayKey);
      results.push({
        dayKey,
        created: result.created,
        source: result.source,
        text: result.prompt.text,
      });
      console.info(
        `[cron] ${dayKey} ${result.created ? "created" : "already present"} source=${result.source}`,
      );
    } catch (caught) {
      console.error(
        `[cron] failed for ${dayKey}:`,
        caught instanceof Error ? caught.message : caught,
      );
      results.push({ dayKey, created: false, error: true });
    }
  }

  const failed = results.some((result) => "error" in result);
  return NextResponse.json({ days: results }, { status: failed ? 500 : 200 });
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
