import "server-only";

import OpenAI, { toFile } from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { CATEGORIES } from "./types";
import type { Category, Prompt, SpeechMetrics } from "./types";

export const TRANSCRIPTION_MODEL =
  process.env.OPENAI_TRANSCRIPTION_MODEL ?? "gpt-4o-mini-transcribe";
export const ANALYSIS_MODEL = process.env.OPENAI_ANALYSIS_MODEL ?? "gpt-4o-mini";

export type AnalysisStage =
  | "config"
  | "transcription"
  | "empty_transcript"
  | "analysis"
  | "generation"
  | "unknown";

/** Carries a stage for logging plus copy that is safe to show the user. */
export class AnalysisError extends Error {
  readonly stage: AnalysisStage;
  readonly status: number;
  readonly userMessage: string;

  constructor(
    stage: AnalysisStage,
    userMessage: string,
    status = 502,
    cause?: unknown,
  ) {
    super(userMessage);
    this.name = "AnalysisError";
    this.stage = stage;
    this.status = status;
    this.userMessage = userMessage;
    this.cause = cause;
  }
}

let client: OpenAI | null = null;

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AnalysisError(
      "config",
      "Analysis isn't configured yet. Add an OpenAI API key to continue.",
      503,
    );
  }
  client ??= new OpenAI({ apiKey, timeout: 60_000, maxRetries: 1 });
  return client;
}

export function isOpenAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function transcribeAudio(
  audio: Blob,
  filename: string,
): Promise<string> {
  try {
    const file = await toFile(audio, filename, {
      type: audio.type || "audio/webm",
    });
    const result = await getClient().audio.transcriptions.create({
      file,
      model: TRANSCRIPTION_MODEL,
      language: "en",
      response_format: "text",
    });

    // response_format "text" resolves to a plain string.
    return String(result ?? "").trim();
  } catch (caught) {
    if (caught instanceof AnalysisError) throw caught;
    throw new AnalysisError(
      "transcription",
      "We couldn't process that recording. Please try again.",
      502,
      caught,
    );
  }
}

const CoachingNoteSchema = z.object({
  title: z.string(),
  explanation: z.string(),
});

/**
 * The scoring and coaching contract.
 *
 * There is deliberately no overall score field. The model rates the four
 * dimensions; the weighted overall is computed in `lib/scoring.ts`, so it is
 * reproducible and every change in it traces back to a dimension.
 */
const AnalysisSchema = z.object({
  clarityScore: z.number().int().min(0).max(100),
  structureScore: z.number().int().min(0).max(100),
  concisionScore: z.number().int().min(0).max(100),
  deliveryScore: z.number().int().min(0).max(100),
  scoreNotes: z.object({
    clarity: z.string(),
    structure: z.string(),
    concision: z.string(),
    delivery: z.string(),
  }),
  summary: z.string(),
  strength: CoachingNoteSchema,
  improvement: CoachingNoteSchema,
  exampleRewrite: z.string(),
  encouragement: z.string(),
});

export type QualitativeAnalysis = z.infer<typeof AnalysisSchema>;

const SYSTEM_PROMPT = `You are an expert communication coach reviewing a 60-second spoken response.

You evaluate HOW the person communicated, never whether their opinion is correct. Never agree or disagree with their view.

Score four dimensions from 0 to 100 as integers:
- clarityScore: how understandable and precise the core message is, and how easily a listener follows it.
- structureScore: whether there is a clear point, logical progression, supporting reasoning or examples, and a satisfying ending.
- concisionScore: whether they communicate efficiently, without unnecessary framing, repetition, hedging, or rambling.
- deliveryScore: judge ONLY from the transcript and the measured metrics — pace, filler frequency, hedging, repetition, and sentence completeness.

You have the transcript, the duration, and deterministic metrics. That is all. You cannot hear the audio and you cannot see the speaker, so you must never comment on or claim to measure tone of voice, volume, accent, emotion, charisma, confidence, eye contact, gestures, or body language.

Do not produce an overall score. The app computes it.

Calibration: 50 is an average first attempt, 70 is solid, 85+ is genuinely strong. Be honest but never harsh.

Rules:
- Every observation must point to something in the transcript or the metrics. Quote or paraphrase the specific moment, or cite the specific number.
- The strength is the aspect they did best, consistent with their highest score.
- Identify exactly ONE highest-leverage improvement — the single change that would help most. Do not list several.
- exampleRewrite must preserve the speaker's own meaning, examples, and beliefs. Never invent experiences, evidence, opinions, or facts they did not say. Aim for something they could say aloud in under 30 seconds.
- Keep every field concise: the summary is one sentence, each explanation one or two sentences, each scoreNote a single short clause.
- Be specific and actionable, never generic. Avoid praise that could apply to any response.
- Write in second person, warm and direct, like a coach who wants them to improve.`;

/**
 * Scores the four dimensions and writes the coaching text.
 *
 * The deterministic metrics go in alongside the transcript so the model has
 * measured evidence to reason from rather than guessing at pace or filler use.
 */
export async function analyzeTranscript({
  prompt,
  transcript,
  metrics,
}: {
  prompt: Prompt;
  transcript: string;
  metrics: SpeechMetrics;
}): Promise<QualitativeAnalysis> {
  const rate = (value: number | undefined) =>
    typeof value === "number" ? value.toFixed(1) : "n/a";
  const percent = (value: number | undefined) =>
    typeof value === "number" ? `${(value * 100).toFixed(0)}%` : "n/a";

  const userContent = [
    `SPEAKING PROMPT: ${prompt.text}`,
    `CATEGORY: ${prompt.category}`,
    "",
    "OBJECTIVE METRICS (measured by the app, treat as ground truth):",
    `- Duration: ${metrics.durationSeconds}s of a 60s maximum`,
    `- Word count: ${metrics.wordCount}`,
    `- Pace: ${metrics.wordsPerMinute} words per minute (conversational is roughly 130-160)`,
    `- Filler words: ${metrics.fillerWordCount}${
      metrics.fillerWords.length
        ? ` (${metrics.fillerWords
            .map((filler) => `${filler.word} x${filler.count}`)
            .join(", ")})`
        : ""
    }`,
    `- Filler rate: ${rate(metrics.fillerRate)} per 100 words`,
    `- Hedging: ${metrics.hedgeCount ?? "n/a"} phrases, ${rate(
      metrics.hedgeRate,
    )} per 100 words (e.g. maybe, I think, sort of)`,
    `- Repeated phrasing: ${percent(metrics.repetitionRate)} of three-word sequences repeat`,
    `- Lexical diversity: ${percent(metrics.lexicalDiversity)} unique words`,
    "",
    "TRANSCRIPT:",
    transcript,
  ].join("\n");

  try {
    const completion = await getClient().chat.completions.parse({
      model: ANALYSIS_MODEL,
      temperature: 0.4,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      response_format: zodResponseFormat(AnalysisSchema, "speaking_analysis"),
    });

    const parsed = completion.choices[0]?.message?.parsed;
    if (!parsed) {
      throw new AnalysisError(
        "analysis",
        "We couldn't build your feedback for this one. Please try again.",
        502,
      );
    }
    return parsed;
  } catch (caught) {
    if (caught instanceof AnalysisError) throw caught;
    throw new AnalysisError(
      "analysis",
      "We couldn't build your feedback for this one. Please try again.",
      502,
      caught,
    );
  }
}

const GeneratedPromptSchema = z.object({
  text: z.string().min(20).max(220),
  category: z.enum(CATEGORIES),
  coachingTip: z.string().min(10).max(160),
});

export type GeneratedPrompt = z.infer<typeof GeneratedPromptSchema>;

const PROMPT_SYSTEM = `You write the daily 60-second speaking challenge for a communication-practice app.

A good prompt:
- Can be answered well in 45 to 60 seconds by anyone, with no preparation and no specialist knowledge.
- Draws on the speaker's own experience, memory, or opinion, so they always have material.
- Invites a specific answer rather than a general one. "Describe a time when..." beats "What do you think about...".
- Is a single question or instruction. Never multi-part, never a list of sub-questions.
- Is warm and curious in tone, never an interview screening question or a management cliche.

Avoid entirely:
- Anything requiring current events, statistics, or facts the speaker would have to recall precisely.
- Trauma, grief, health, politics, religion, money specifics, or anything a person would be uncomfortable saying aloud.
- Prompts that reward a rehearsed answer, like "tell me about yourself" or "what is your greatest weakness".

The coachingTip is one short piece of delivery advice specific to this prompt — something to do while speaking, not a restatement of the question.

Choose the category that genuinely fits the prompt you wrote.`;

/**
 * Writes one fresh daily prompt.
 *
 * `avoid` carries recent prompt texts. Without it the model converges fast on
 * the same few shapes — a fortnight of near-identical "describe a time when"
 * questions, which defeats the point of generating them at all.
 */
export async function generateDailyPrompt({
  avoid = [],
  preferredCategory,
}: {
  avoid?: string[];
  preferredCategory?: Category;
} = {}): Promise<GeneratedPrompt> {
  const instructions = [
    preferredCategory
      ? `Write today's prompt in the "${preferredCategory}" category.`
      : "Write today's prompt.",
  ];

  if (avoid.length) {
    instructions.push(
      "",
      "These prompts have been used recently. Do not repeat them, and do not write a rephrasing or close variation of any of them:",
      ...avoid.slice(0, 40).map((text) => `- ${text}`),
    );
  }

  try {
    const completion = await getClient().chat.completions.parse({
      model: ANALYSIS_MODEL,
      // Higher than scoring: variety is the goal here, not consistency.
      temperature: 1,
      messages: [
        { role: "system", content: PROMPT_SYSTEM },
        { role: "user", content: instructions.join("\n") },
      ],
      response_format: zodResponseFormat(GeneratedPromptSchema, "daily_prompt"),
    });

    const parsed = completion.choices[0]?.message?.parsed;
    if (!parsed) {
      throw new AnalysisError("generation", "Could not generate a prompt.", 502);
    }
    return parsed;
  } catch (caught) {
    if (caught instanceof AnalysisError) throw caught;
    throw new AnalysisError(
      "generation",
      "Could not generate a prompt.",
      502,
      caught,
    );
  }
}
