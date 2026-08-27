import { NextResponse } from "next/server";
import {
  ANALYSIS_MODEL,
  AnalysisError,
  analyzeTranscript,
  isOpenAIConfigured,
  transcribeAudio,
} from "@/lib/openai";
import { buildMockSession } from "@/lib/mockAnalysis";
import { getCurrentUser } from "@/lib/auth/server";
import { getDailyPromptForDay, resolvePromptById } from "@/lib/dailyPrompts";
import { getScoringMode, type ScoringMode } from "@/lib/scoringMode";
import { MAX_DURATION_MS, MIN_DURATION_MS } from "@/lib/recording";
import {
  applyScoreConstraints,
  computeMetrics,
  isTranscriptUsable,
} from "@/lib/scoring";
import { recordCompletedSession } from "@/lib/sessions";
import { toDayKey } from "@/lib/streaks";
import { FirebaseConfigError } from "@/lib/firebase/admin";
import type { Session } from "@/lib/types";

/**
 * The analysis pipeline.
 *
 *   audio -> OpenAI transcription
 *         -> deterministic transcript/timing metrics
 *         -> OpenAI structured rubric scoring + coaching
 *         -> deterministic overall score
 *         -> Firestore
 *
 * The model rates the four dimensions. The overall score is computed here, from
 * those four, so it is reproducible and always explainable by a dimension.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

function log(stage: string, id: string, extra?: Record<string, unknown>) {
  const details = extra
    ? ` ${Object.entries(extra)
        .map(([key, value]) => `${key}=${value}`)
        .join(" ")}`
    : "";
  console.info(`[analyze:${id}] ${stage}${details}`);
}

/**
 * Timing summary for one request.
 *
 * Deliberately shape-only: character counts and durations, never transcript
 * text. Logs are the easiest place to leak what someone said.
 */
function logTimings(
  requestId: string,
  mode: ScoringMode,
  timings: Record<string, number>,
  totalMs: number,
) {
  const parts = Object.entries(timings).map(([stage, ms]) => `${stage}=${ms}ms`);
  console.info(
    `[analyze:${requestId}] latency mode=${mode} ${parts.join(" ")} total=${totalMs}ms`,
  );
}

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function handleStorageError(caught: unknown, requestId: string) {
  if (caught instanceof FirebaseConfigError) {
    console.error(`[analyze:${requestId}] firebase not configured`);
    return fail(
      "Saving sessions isn't configured yet. Add your Firebase credentials to continue.",
      503,
    );
  }
  console.error(
    `[analyze:${requestId}] failed to store session:`,
    caught instanceof Error ? caught.message : caught,
  );
  return fail("We analyzed your response but couldn't save it.", 502);
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const requestStartedAt = Date.now();
  const mode = getScoringMode();
  const timings: Record<string, number> = {};

  // ---- 0. Identify the speaker -----------------------------------------
  // Before anything expensive. An anonymous session has no owner, no streak,
  // and no way to be read back, so there is nothing worth spending a
  // transcription call on.
  let user;
  try {
    user = await getCurrentUser();
  } catch (caught) {
    return handleStorageError(caught, requestId);
  }
  if (!user) {
    log("unauthenticated", requestId);
    return fail("Please sign in to save and see your results.", 401);
  }

  // ---- 1. Validate the upload ------------------------------------------
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return fail("Expected an audio upload.", 400);
  }

  const audio = formData.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) {
    return fail("We didn't receive any audio. Please try again.", 400);
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return fail("That recording is too large to analyze.", 413);
  }

  const durationSeconds = Number(formData.get("durationSeconds"));
  if (!Number.isFinite(durationSeconds)) {
    return fail("Missing recording duration.", 400);
  }
  if (durationSeconds * 1000 < MIN_DURATION_MS) {
    return fail("That recording was too short to analyze.", 422);
  }

  const dayKey = toDayKey();
  const promptId = String(formData.get("promptId") ?? "");
  // Claimed retry parent. Treated as a claim, not a fact: the transaction only
  // honours it if the session exists and belongs to this user.
  const retryOfSessionId = String(formData.get("retryOf") ?? "") || null;

  let prompt;
  try {
    prompt =
      (promptId ? await resolvePromptById(promptId) : undefined) ??
      (await getDailyPromptForDay(dayKey));
  } catch (caught) {
    return handleStorageError(caught, requestId);
  }

  const cappedDuration = Math.min(durationSeconds, MAX_DURATION_MS / 1000);

  if (mode === "mock") {
    log("mock analysis", requestId, { prompt: prompt.id });
    const session = buildMockSession(crypto.randomUUID(), prompt, cappedDuration);
    try {
      const record = await recordCompletedSession({
        session,
        userId: user.uid,
        challengeDate: dayKey,
        scoringSource: "mock",
        retryOfSessionId,
      });
      log("completion recorded", requestId, {
        streak: record.streakEarned,
        daily: record.isDailyCompletion,
        attempt: record.attemptNumber,
        xp: record.xpEarned,
      });
    } catch (caught) {
      return handleStorageError(caught, requestId);
    }
    logTimings(requestId, mode, timings, Date.now() - requestStartedAt);
    return NextResponse.json({ id: session.id });
  }

  if (!isOpenAIConfigured()) {
    log("missing api key", requestId);
    return fail(
      "Analysis isn't configured yet. Add an OpenAI API key to continue.",
      503,
    );
  }

  try {
    // ---- 2. Transcribe -------------------------------------------------
    const filename =
      audio instanceof File && audio.name ? audio.name : "response.webm";

    log("transcription started", requestId, {
      mode,
      bytes: audio.size,
      type: audio.type || "unknown",
    });
    const transcriptionStartedAt = Date.now();
    const transcript = await transcribeAudio(audio, filename);
    timings.transcription = Date.now() - transcriptionStartedAt;
    log("transcription completed", requestId, {
      ms: timings.transcription,
      chars: transcript.length,
    });

    if (!isTranscriptUsable(transcript)) {
      log("empty transcript", requestId);
      return fail(
        "We couldn't make out enough speech in that recording. Find a quieter spot and give it another go.",
        422,
      );
    }

    // ---- 3. Deterministic metrics --------------------------------------
    const metrics = computeMetrics(transcript, cappedDuration);

    // ---- 4. Rubric scoring and coaching --------------------------------
    log("analysis started", requestId, {
      words: metrics.wordCount,
      wpm: metrics.wordsPerMinute,
    });
    const analysisStartedAt = Date.now();
    const analysis = await analyzeTranscript({ prompt, transcript, metrics });
    timings.analysis = Date.now() - analysisStartedAt;

    // ---- 5. Deterministic constraints, then the overall score -----------
    // The model proposes; the measurements dispose. Every ceiling applied here
    // comes from something the model cannot argue with, and the overall score
    // is computed from the constrained values and nowhere else.
    const constrained = applyScoreConstraints(
      {
        clarity: analysis.clarityScore,
        structure: analysis.structureScore,
        concision: analysis.concisionScore,
        delivery: analysis.deliveryScore,
      },
      metrics,
    );

    const scores = constrained.scores;
    const overallScore = constrained.overallScore;

    log("analysis completed", requestId, {
      ms: timings.analysis,
      overall: overallScore,
      raw: constrained.rawOverallScore,
      tier: constrained.completeness.tier,
      status: constrained.status,
      caps: constrained.appliedCaps.length,
    });

    // The penalty math, server-side only. This is the log to read when a score
    // looks wrong; it deliberately carries no transcript text.
    if (constrained.appliedCaps.length > 0) {
      console.info(
        `[analyze:${requestId}] caps ` +
          constrained.appliedCaps
            .map((cap) => `${cap.dimension} ${cap.from}->${cap.cap} (${cap.reason})`)
            .join(" | "),
      );
    }

    const session: Session = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      challengeDate: dayKey,
      promptId: prompt.id,
      promptText: prompt.text,
      category: prompt.category,
      transcript,
      overallScore,
      scores,
      scoreNotes: analysis.scoreNotes,
      metrics,
      feedback: {
        summary: analysis.summary,
        strength: {
          title: analysis.strength.title,
          detail: analysis.strength.explanation,
        },
        opportunity: {
          title: analysis.improvement.title,
          detail: analysis.improvement.explanation,
        },
        rewrite: analysis.exampleRewrite,
        encouragement: analysis.encouragement,
      },
      // Filled in by the transaction below, which is the only thing that can
      // know them without racing a concurrent submission.
      streak: 0,
      dayNumber: 0,
      scoringSource: "llm",
      scoringVersion: constrained.scoringVersion,
      scoringStatus: constrained.status,
    };

    // ---- 6. Persist and advance the streak, atomically -------------------
    // One transaction: either the session exists and the streak reflects it, or
    // neither happened. Splitting these allowed a streak to advance for a
    // session that then failed to save.
    const record = await recordCompletedSession({
      session,
      userId: user.uid,
      challengeDate: dayKey,
      scoringSource: "llm",
      modelVersion: ANALYSIS_MODEL,
      retryOfSessionId,
      scoring: constrained,
    });
    log("session stored", requestId, {
      session: session.id,
      streak: record.streakEarned,
      day: record.dayNumber,
      daily: record.isDailyCompletion,
      attempt: record.attemptNumber,
      xp: record.xpEarned,
      quests: record.questsCompleted.length,
      best: record.isPersonalBest,
    });

    logTimings(requestId, mode, timings, Date.now() - requestStartedAt);
    return NextResponse.json({ id: session.id });
  } catch (caught) {
    if (caught instanceof FirebaseConfigError) {
      return handleStorageError(caught, requestId);
    }
    if (caught instanceof AnalysisError) {
      // Log the underlying cause server-side; never return it to the client.
      console.error(
        `[analyze:${requestId}] failed at ${caught.stage}:`,
        caught.cause instanceof Error ? caught.cause.message : caught.cause,
      );
      logTimings(requestId, mode, timings, Date.now() - requestStartedAt);
      return fail(caught.userMessage, caught.status);
    }
    console.error(`[analyze:${requestId}] unexpected failure:`, caught);
    return fail("Something went wrong analyzing your response.", 500);
  }
}
