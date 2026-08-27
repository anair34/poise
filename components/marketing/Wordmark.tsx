import Link from "next/link";
import { PoiseLogo } from "@/components/brand/PoiseLogo";
import { cn } from "@/lib/cn";

/**
 * The brand, as a link home. Kept as a thin wrapper so every call site picks up
 * changes to the logo itself from components/brand.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="Poise home"
      className={cn(
        "inline-flex items-center rounded text-[0.95rem] transition-opacity duration-200 hover:opacity-70",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember/40 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
        className,
      )}
    >
      <PoiseLogo />
    </Link>
  );
}
