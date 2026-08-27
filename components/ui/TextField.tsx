"use client";

import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const fieldClasses =
  "w-full rounded-lg border border-hairline bg-paper/60 px-3.5 py-3 text-[0.95rem] text-ink " +
  "placeholder:text-ink-muted transition-colors duration-200 " +
  "hover:border-ink/20 focus:border-ember/50 focus:bg-canvas focus:outline-none " +
  "focus:ring-2 focus:ring-ember/25 disabled:opacity-60";

export function TextField({
  label,
  action,
  error,
  className,
  id,
  ...props
}: {
  label: string;
  /** Optional control on the label row, e.g. a "Forgot password?" link. */
  action?: ReactNode;
  error?: string | null;
} & ComponentProps<"input">) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const errorId = `${fieldId}-error`;

  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label
          htmlFor={fieldId}
          className="text-[0.82rem] font-medium text-ink-soft"
        >
          {label}
        </label>
        {action}
      </div>
      <input
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(fieldClasses, error && "border-ember/60")}
        {...props}
      />
      {error ? (
        <p id={errorId} className="mt-1.5 text-[0.78rem] text-ember-deep">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Password input with a reveal toggle, matching TextField's styling. */
export function PasswordField({
  label,
  action,
  error,
  className,
  id,
  ...props
}: {
  label: string;
  action?: ReactNode;
  error?: string | null;
} & Omit<ComponentProps<"input">, "type">) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const errorId = `${fieldId}-error`;
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label
          htmlFor={fieldId}
          className="text-[0.82rem] font-medium text-ink-soft"
        >
          {label}
        </label>
        {action}
      </div>
      <div className="relative">
        <input
          id={fieldId}
          type={isVisible ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(fieldClasses, "pr-11", error && "border-ember/60")}
          {...props}
        />
        <button
          type="button"
          onClick={() => setIsVisible((visible) => !visible)}
          // Toggling visibility is a convenience, not a landmark. Keeping it out
          // of the tab order stops it interrupting the email → password → submit
          // path, while it stays reachable by pointer and by screen readers.
          tabIndex={-1}
          aria-label={isVisible ? "Hide password" : "Show password"}
          className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-ink-muted transition-colors duration-200 hover:text-ink"
        >
          {isVisible ? <EyeOffGlyph /> : <EyeGlyph />}
        </button>
      </div>
      {error ? (
        <p id={errorId} className="mt-1.5 text-[0.78rem] text-ember-deep">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function EyeGlyph() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      className="size-[1.15rem]"
    >
      <path d="M1.8 10S4.7 4.8 10 4.8 18.2 10 18.2 10 15.3 15.2 10 15.2 1.8 10 1.8 10Z" />
      <circle cx="10" cy="10" r="2.4" />
    </svg>
  );
}

function EyeOffGlyph() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      className="size-[1.15rem]"
    >
      <path d="M7.3 5.4A7.9 7.9 0 0 1 10 4.8c5.3 0 8.2 5.2 8.2 5.2a14 14 0 0 1-2.3 2.9M4.4 6.8A13.9 13.9 0 0 0 1.8 10S4.7 15.2 10 15.2c1 0 1.9-.2 2.7-.5" />
      <path d="M8.3 8.3a2.4 2.4 0 0 0 3.4 3.4" />
      <path d="M2.5 2.5l15 15" />
    </svg>
  );
}
