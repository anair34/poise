import type { ReactNode } from "react";
import { ChallengeHeader } from "./ChallengeHeader";
import { MicButton } from "./MicButton";
import { PromptBlock } from "./PromptBlock";
import { Waveform } from "./Waveform";
import { cn } from "@/lib/cn";
import type { RecorderState } from "@/lib/types";

/**
 * Shared layout for both the live /practice recorder and the landing page
 * preview. Hook-free on purpose so it can render on the server.
 */
export function RecorderCard({
  category,
  streak,
  prompt,
  state,
  timerLabel,
  hint,
  levels,
  error,
  interactive = true,
  showRing = false,
  onStart,
  onFinish,
  onCancel,
  className,
}: {
  category: string;
  streak: number;
  prompt: string;
  state: RecorderState;
  timerLabel: string;
  hint: ReactNode;
  levels?: number[];
  error?: string | null;
  interactive?: boolean;
  showRing?: boolean;
  onStart?: () => void;
  onFinish?: () => void;
  onCancel?: () => void;
  className?: string;
}) {
  const isRecording = state === "recording";
  const isProcessing = state === "processing";

  return (
    <div
      className={cn(
        "w-full rounded-2xl border border-hairline bg-canvas",
        "shadow-[0_30px_60px_-45px_rgba(17,17,17,0.35)]",
        className,
      )}
    >
      <ChallengeHeader category={category} streak={streak} />

      <div className="px-6 pb-7 pt-7 sm:px-9 sm:pb-9 sm:pt-9">
        <PromptBlock prompt={prompt} />

        <div className="mt-9 flex flex-col items-center">
          <MicButton
            state={state}
            showRing={showRing || isRecording}
            disabled={isProcessing}
            interactive={interactive}
            label={isRecording ? "Finish recording" : "Start speaking"}
            onClick={isRecording ? onFinish : onStart}
          />

          <p
            className={cn(
              "mt-6 font-mono text-[1.75rem] tabular-nums tracking-tight transition-colors duration-300 sm:text-[2rem]",
              isRecording ? "text-ember" : "text-ink",
            )}
            aria-live="off"
          >
            {timerLabel}
          </p>

          <div className="mt-1.5 min-h-[1.25rem] text-center text-[0.78rem] text-ink-muted">
            {hint}
          </div>

          <Waveform
            levels={levels}
            live={isRecording}
            animated={!isProcessing}
            className="mt-7 w-full max-w-[280px]"
          />

          {error ? (
            <p
              role="alert"
              className="mt-5 max-w-[34ch] rounded-md border border-ember/25 bg-ember/[0.06] px-3.5 py-2.5 text-center text-[0.8rem] leading-relaxed text-ink-soft"
            >
              {error}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-hairline px-6 py-4 sm:px-7">
        <button
          type="button"
          onClick={onCancel}
          disabled={!interactive || !isRecording}
          className="rounded text-[0.78rem] text-ink-muted transition-colors duration-200 hover:text-ink disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember/40"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onFinish}
          disabled={!interactive || !isRecording}
          className="group rounded text-[0.78rem] font-medium text-ink transition-colors duration-200 hover:text-ember disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember/40"
        >
          Finish{" "}
          <span
            aria-hidden
            className="inline-block transition-transform duration-200 group-hover:translate-x-0.5"
          >
            →
          </span>
        </button>
      </div>
    </div>
  );
}
