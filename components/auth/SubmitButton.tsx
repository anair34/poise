"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Primary form action. Ember when usable, quiet when not. */
export function SubmitButton({
  children,
  disabled,
  isPending,
  pendingLabel,
  className,
}: {
  children: ReactNode;
  disabled?: boolean;
  isPending?: boolean;
  pendingLabel?: string;
  className?: string;
}) {
  return (
    <button
      type="submit"
      disabled={disabled || isPending}
      className={cn(
        "w-full rounded-lg px-5 py-3 text-[0.95rem] font-medium",
        "transition-[background-color,color,transform] duration-200 ease-out active:translate-y-px",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember/40 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
        disabled || isPending
          ? "cursor-not-allowed bg-paper text-ink-muted"
          : "bg-ember text-white hover:bg-ember-deep hover:shadow-[0_8px_20px_-12px_rgba(217,85,26,0.7)]",
        className,
      )}
    >
      {isPending && pendingLabel ? pendingLabel : children}
    </button>
  );
}

/** Shared error banner for the auth forms. */
export function AuthError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="mt-5 rounded-lg border border-ember/25 bg-ember/[0.06] px-3.5 py-2.5 text-[0.82rem] leading-[1.55] text-ink-soft"
    >
      {message}
    </p>
  );
}
