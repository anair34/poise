import { NextResponse } from "next/server";
import { buildMockSession } from "@/lib/mockAnalysis";
import { getDailyPrompt, getPromptById } from "@/lib/prompts";
import { MAX_DURATION_MS, MIN_DURATION_MS } from "@/lib/recording";
import { saveSession } from "@/lib/sessionStore";

export const runtime = "nodejs";

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected an audio upload." },
      { status: 400 },
    );
  }

  const audio = formData.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json(
      { error: "We didn't receive any audio. Please try again." },
      { status: 400 },
    );
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { error: "That recording is too large to analyze." },
      { status: 413 },
    );
  }

  const durationSeconds = Number(formData.get("durationSeconds"));
  if (!Number.isFinite(durationSeconds)) {
    return NextResponse.json(
      { error: "Missing recording duration." },
      { status: 400 },
    );
  }
  if (durationSeconds * 1000 < MIN_DURATION_MS) {
    return NextResponse.json(
      { error: "That recording was too short to analyze." },
      { status: 422 },
    );
  }

  const promptId = String(formData.get("promptId") ?? "");
  const prompt = getPromptById(promptId) ?? getDailyPrompt();

  // TODO: replace with Whisper transcription + GPT analysis.
  const session = buildMockSession(
    crypto.randomUUID(),
    prompt,
    Math.min(durationSeconds, MAX_DURATION_MS / 1000),
  );
  saveSession(session);

  return NextResponse.json({ id: session.id });
}
