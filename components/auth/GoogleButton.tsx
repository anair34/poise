"use client";

import { GoogleGlyph } from "@/components/ui/GoogleGlyph";
import { cn } from "@/lib/cn";

export function GoogleButton({
  label = "Continue with Google",
  disabled,
  onClick,
  className,
}: {
  label?: string;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center justify-center gap-2.5 rounded-lg border border-hairline bg-canvas px-5 py-3",
        "text-[0.95rem] font-medium text-ink transition-[background-color,border-color,transform] duration-200 ease-out",
        "hover:border-ink/25 hover:bg-paper active:translate-y-px",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember/40 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
    >
      <GoogleGlyph />
      {label}
    </button>
  );
}
