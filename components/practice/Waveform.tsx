import { cn } from "@/lib/cn";

// Deterministic amplitudes keep server and client markup identical when idle.
const IDLE_AMPLITUDES = [
  0.32, 0.54, 0.78, 0.46, 0.92, 0.64, 0.38, 0.72, 1, 0.58, 0.44, 0.86, 0.6,
  0.34, 0.68, 0.96, 0.5, 0.4, 0.76, 0.62, 0.28, 0.82, 0.56, 0.7, 0.42, 0.9,
  0.48, 0.36, 0.66, 0.52, 0.74, 0.44, 0.88, 0.4, 0.6, 0.3,
];

export function Waveform({
  levels,
  live = false,
  animated = true,
  className,
}: {
  /** Live amplitudes in the 0–1 range, newest last. */
  levels?: number[];
  live?: boolean;
  animated?: boolean;
  className?: string;
}) {
  const bars = levels ?? IDLE_AMPLITUDES;

  return (
    <div
      aria-hidden
      className={cn(
        "flex h-10 items-center justify-center gap-[3px]",
        className,
      )}
    >
      {bars.map((amplitude, index) => (
        <span
          key={index}
          className={cn(
            "w-[2.5px] rounded-full",
            live ? "bg-ember/70 transition-[height] duration-75 ease-out" : "bg-ink/15",
            !live && animated && "animate-wave motion-reduce:animate-none",
          )}
          style={{
            height: `${Math.max(6, Math.round(amplitude * 100))}%`,
            animationDelay: live ? undefined : `${(index % 10) * 0.09}s`,
          }}
        />
      ))}
    </div>
  );
}
