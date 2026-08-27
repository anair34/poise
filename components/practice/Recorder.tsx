"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RecorderCard } from "./RecorderCard";
import { formatClock } from "@/lib/format";
import { MAX_DURATION_MS, fileExtensionFor } from "@/lib/recording";
import { useAudioRecorder } from "@/lib/useAudioRecorder";
import type { Prompt, RecorderState } from "@/lib/types";

const PROCESSING_MESSAGES = [
  "Transcribing your response…",
  "Looking for patterns…",
  "Building your feedback…",
];

export function Recorder({
  prompt,
  dayNumber,
  streak,
}: {
  prompt: Prompt;
  dayNumber: number;
  streak: number;
}) {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [messageIndex, setMessageIndex] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const upload = useCallback(
    async (blob: Blob, durationSeconds: number) => {
      setUploadError(null);
      setIsProcessing(true);
      setMessageIndex(0);

      try {
        const formData = new FormData();
        formData.append(
          "audio",
          blob,
          `response.${fileExtensionFor(blob.type)}`,
        );
        formData.append("promptId", prompt.id);
        formData.append("durationSeconds", durationSeconds.toFixed(2));

        const response = await fetch("/api/analyze", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(payload?.error ?? "Analysis failed.");
        }

        const { id } = (await response.json()) as { id: string };
        router.push(`/results/${id}`);
      } catch (caught) {
        setIsProcessing(false);
        setUploadError(
          caught instanceof Error && caught.message
            ? caught.message
            : "We couldn't analyze that recording. Please try again.",
        );
      }
    },
    [prompt.id, router],
  );

  const recorder = useAudioRecorder({ onComplete: upload });

  // Cycle the processing copy so the wait feels considered rather than stalled.
  useEffect(() => {
    if (!isProcessing) return;
    const timer = setInterval(() => {
      setMessageIndex((index) =>
        Math.min(index + 1, PROCESSING_MESSAGES.length - 1),
      );
    }, 2400);
    return () => clearInterval(timer);
  }, [isProcessing]);

  const state: RecorderState = isProcessing
    ? "processing"
    : recorder.isRecording
      ? "recording"
      : "ready";

  const handleStart = useCallback(() => {
    setUploadError(null);
    void recorder.start();
  }, [recorder]);

  if (!recorder.supported) {
    return (
      <RecorderCard
        dayNumber={dayNumber}
        category={prompt.category}
        streak={streak}
        prompt={prompt.text}
        state="ready"
        timerLabel={formatClock(MAX_DURATION_MS)}
        hint="Recording isn't available here."
        interactive={false}
        error="This browser can't record audio. Try the latest Chrome, Edge, or Safari on a desktop."
      />
    );
  }

  const hint =
    state === "processing" ? (
      <span key={messageIndex} className="animate-[fade-in_400ms_ease-out]">
        {PROCESSING_MESSAGES[messageIndex]}
      </span>
    ) : state === "recording" ? (
      <span className="inline-flex items-center gap-2 text-ink-soft">
        <span
          aria-hidden
          className="size-1.5 animate-pulse rounded-full bg-ember motion-reduce:animate-none"
        />
        Recording…
      </span>
    ) : recorder.isRequesting ? (
      "Waiting for microphone access…"
    ) : (
      "Start speaking. You have sixty seconds."
    );

  return (
    <div>
      <RecorderCard
        dayNumber={dayNumber}
        category={prompt.category}
        streak={streak}
        prompt={prompt.text}
        state={state}
        timerLabel={
          state === "ready" && !recorder.isRequesting
            ? formatClock(MAX_DURATION_MS)
            : formatClock(recorder.elapsedMs)
        }
        hint={hint}
        levels={recorder.isRecording ? recorder.levels : undefined}
        error={uploadError ?? recorder.error}
        onStart={handleStart}
        onFinish={recorder.finish}
        onCancel={recorder.cancel}
      />

      <p className="mt-5 text-center text-[0.78rem] text-ink-muted">
        {state === "processing"
          ? "Hang tight — this usually takes a few seconds."
          : prompt.coachingTip}
      </p>
      <p aria-live="polite" className="sr-only">
        {state === "recording"
          ? "Recording in progress"
          : state === "processing"
            ? PROCESSING_MESSAGES[messageIndex]
            : ""}
      </p>
    </div>
  );
}
