import { cn } from "@/lib/cn";

/**
 * `size="large"` is for the split recorder layout, where the prompt owns a
 * whole column and the default measure would leave it stranded in white space.
 */
export function PromptBlock({
  prompt,
  size = "default",
}: {
  prompt: string;
  size?: "default" | "large";
}) {
  return (
    <div>
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-ink-muted">
        Today&apos;s challenge
      </p>
      <p
        className={cn(
          "mt-4 font-medium leading-[1.25] tracking-[-0.015em] text-ink",
          size === "large"
            ? "max-w-[20ch] text-[1.5rem] sm:text-[1.9rem] lg:text-[clamp(2rem,2.8vw,2.9rem)]"
            : "max-w-[24ch] text-[1.35rem] sm:text-[1.6rem]",
        )}
      >
        {prompt}
      </p>
    </div>
  );
}
