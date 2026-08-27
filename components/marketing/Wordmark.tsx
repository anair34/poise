import Link from "next/link";
import { cn } from "@/lib/cn";

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn(
        "inline-flex items-center gap-2 text-[0.95rem] font-semibold tracking-[-0.02em] text-ink",
        className,
      )}
    >
      <span className="size-[7px] rounded-full bg-ember" aria-hidden />
      Poise
    </Link>
  );
}
