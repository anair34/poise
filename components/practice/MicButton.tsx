import { cn } from "@/lib/cn";
import type { RecorderState } from "@/lib/types";

function MicIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      className="size-7"
      aria-hidden
    >
      <path d="M12 4.5a2.75 2.75 0 0 1 2.75 2.75v4a2.75 2.75 0 0 1-5.5 0v-4A2.75 2.75 0 0 1 12 4.5Z" />
      <path d="M6.75 11.25a5.25 5.25 0 0 0 10.5 0M12 16.5V19.5M9 19.5h6" />
    </svg>
  );
}

function StopIcon() {
  return (
    <span
      aria-hidden
      className="size-[22px] rounded-[5px] bg-ember transition-transform duration-200"
    />
  );
}

const SIZE = "size-[92px] sm:size-[104px]";

export function MicButton({
  state,
  showRing = false,
  disabled = false,
  interactive = true,
  label,
  onClick,
}: {
  state: RecorderState;
  /** Expanding ring, used while recording and decoratively in the mockup. */
  showRing?: boolean;
  disabled?: boolean;
  interactive?: boolean;
  label?: string;
  onClick?: () => void;
}) {
  const surface = cn(
    "relative flex items-center justify-center rounded-full transition-[background-color,border-color,transform,box-shadow] duration-200 ease-out",
    SIZE,
    state === "recording"
      ? "border border-ember/35 bg-canvas"
      : state === "processing"
        ? "border border-hairline bg-paper text-ink-muted"
        : "bg-ember text-white",
    interactive &&
      !disabled &&
      "hover:scale-[1.03] active:scale-[0.98] motion-reduce:hover:scale-100",
    interactive &&
      state === "ready" &&
      !disabled &&
      "hover:shadow-[0_14px_34px_-18px_rgba(244,107,42,0.85)]",
    disabled && "cursor-not-allowed opacity-70",
  );

  const content = (
    <>
      {showRing ? (
        <span
          aria-hidden
          className="absolute inset-0 animate-pulse-ring rounded-full border border-ember/30 motion-reduce:animate-none"
        />
      ) : null}
      {state === "recording" ? (
        <StopIcon />
      ) : state === "processing" ? (
        <span
          aria-hidden
          className="size-8 animate-spin rounded-full border-2 border-ink/10 border-t-ember motion-reduce:animate-none"
        />
      ) : (
        <MicIcon />
      )}
    </>
  );

  if (!interactive) {
    return (
      <div className="relative flex items-center justify-center">
        <div className={surface}>{content}</div>
      </div>
    );
  }

  return (
    <div className="relative flex items-center justify-center">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className={cn(
          surface,
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember/40 focus-visible:ring-offset-4 focus-visible:ring-offset-canvas",
        )}
      >
        {content}
      </button>
    </div>
  );
}
