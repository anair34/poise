"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RecorderCard } from "./RecorderCard";
import { RetryBanner } from "./RetryBanner";
import { SignInButton } from "@/components/auth/SignInButton";
import { formatClock } from "@/lib/format";
import { MAX_DURATION_MS, fileExtensionFor } from "@/lib/recording";
import { useAudioRecorder } from "@/lib/useAudioRecorder";
import type { Prompt, RecorderState } from "@/lib/types";
import type { RetryContext } from "./RetryBanner";

const PROCESSING_MESSAGES = [
  "Transcribing your response…",
  "Looking for patterns…",
  "Building your feedback…",
];

interface PendingRecording {
  blob: Blob;
  durationSeconds: number;
}

export function Recorder({
  prompt,
  streak,
  isSignedIn,
  retry,
}: {
  prompt: Prompt;
  streak: number;
  isSignedIn: boolean;
  /** Present when this is a "beat your score" attempt. */
  retry?: RetryContext;
}) {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [messageIndex, setMessageIndex] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingRecording | null>(null);

  const submit = useCallback(
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
        if (retry) formData.append("retryOf", retry.sessionId);

        const response = await fetch("/api/analyze", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;

          // The session expired between recording and submitting. Keep the audio
          // and ask for a sign-in rather than discarding a minute of speaking.
          if (response.status === 401) {
            setIsProcessing(false);
            setPending({ blob, durationSeconds });
            return;
          }
          throw new Error(payload?.error ?? "Analysis failed.");
        }

        const { id } = (await response.json()) as { id: string };
        setPending(null);
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
    [prompt.id, retry, router],
  );

  /**
   * Recording is allowed while signed out, but results are not. Rather than
   * discovering that after speaking for a minute, the finished audio is held in
   * memory and submitted as soon as sign-in completes. Google's popup flow keeps
   * the page alive, so the blob survives.
   */
  const handleComplete = useCallback(
    (blob: Blob, durationSeconds: number) => {
      if (!isSignedIn) {
        setPending({ blob, durationSeconds });
        return;
      }
      void submit(blob, durationSeconds);
    },
    [isSignedIn, submit],
  );

  const recorder = useAudioRecorder({ onComplete: handleComplete });

  const handleSignedIn = useCallback(() => {
    if (pending) void submit(pending.blob, pending.durationSeconds);
  }, [pending, submit]);

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
    setPending(null);
    void recorder.start();
  }, [recorder]);

  if (!recorder.supported) {
    return (
      <RecorderCard
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

  if (pending) {
    return (
      <div>
        <RecorderCard
          layout="split"
          category={prompt.category}
          streak={streak}
          prompt={prompt.text}
          state="ready"
          timerLabel={formatClock(pending.durationSeconds * 1000)}
          hint="Your recording is ready."
          interactive={false}
        />

        <div className="mt-7 rounded-xl border border-hairline bg-paper px-5 py-5 text-center">
          <p className="text-[0.95rem] font-medium text-ink">
            Sign up to see your feedback
          </p>
          <div className="mt-4 flex flex-col items-center gap-3">
            <SignInButton className="w-full" onSignedIn={handleSignedIn} />
            <button
              type="button"
              onClick={() => setPending(null)}
              className="rounded px-2 py-1 text-[0.8rem] text-ink-muted transition-colors duration-200 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember/40"
            >
              Discard and record again
            </button>
          </div>
        </div>
      </div>
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
      {retry ? <RetryBanner retry={retry} /> : null}
      <RecorderCard
        layout="split"
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

      {state === "processing" ? (
        <p className="mt-5 text-center text-[0.78rem] text-ink-muted">
          Hang tight — this usually takes a few seconds.
        </p>
      ) : null}
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
