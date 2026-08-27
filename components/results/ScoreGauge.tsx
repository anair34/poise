import { cn } from "@/lib/cn";

const SEGMENTS = 13;
/** Degrees of sweep, centred on straight up. */
const SPREAD = 150;
const CENTER = 100;
const RADIUS = 74;

/**
 * The overall score as a segmented arc.
 *
 * Discrete blocks rather than a continuous ring: a solid arc invites reading
 * the exact angle, which implies a precision the score does not have. Counting
 * lit segments communicates "roughly this far along" honestly, and echoes the
 * waveform bars used elsewhere in the app.
 */
export function ScoreGauge({
  score,
  className,
}: {
  score: number;
  className?: string;
}) {
  const clamped = Math.min(100, Math.max(0, score));
  const lit = Math.round((clamped / 100) * SEGMENTS);
  const step = SPREAD / (SEGMENTS - 1);

  return (
    <div className={cn("relative inline-flex flex-col items-center", className)}>
      <svg
        viewBox="0 0 200 132"
        className="w-[13.5rem] sm:w-[15rem]"
        role="img"
        aria-label={`Overall score ${clamped} out of 100`}
      >
        {Array.from({ length: SEGMENTS }, (_, index) => {
          const angle = -SPREAD / 2 + index * step;
          const isLit = index < lit;
          return (
            <g key={index} transform={`rotate(${angle} ${CENTER} ${CENTER})`}>
              <rect
                x={CENTER - 8}
                y={CENTER - RADIUS - 14}
                width={16}
                height={30}
                rx={7}
                className={cn(
                  isLit ? "fill-ember" : "fill-hairline",
                  // Later segments fade in slightly, so a high score reads as
                  // building rather than switching on all at once.
                  isLit && index > SEGMENTS - 4 && "fill-ember-deep",
                )}
              />
            </g>
          );
        })}
      </svg>

      <div className="absolute inset-x-0 bottom-[0.35rem] flex flex-col items-center">
        <p className="flex items-baseline gap-1">
          <span className="font-mono text-[3rem] leading-none tracking-[-0.04em] tabular-nums text-ink sm:text-[3.4rem]">
            {clamped}
          </span>
          <span className="text-[0.9rem] text-ink-muted">/ 100</span>
        </p>
      </div>
    </div>
  );
}
