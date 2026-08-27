import { Eyebrow } from "@/components/ui/Eyebrow";
import { getScoreDelta, safeScore } from "@/lib/results";
import type { Session } from "@/lib/types";

export function ScoreHero({ session }: { session: Session }) {
  const score = safeScore(session.overallScore);
  const delta = getScoreDelta(session);

  return (
    <section className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-md">
        <Eyebrow>Today&apos;s session</Eyebrow>
        <h1 className="mt-5 text-[clamp(2.1rem,4.5vw,2.9rem)] font-semibold leading-[1.05] tracking-[-0.035em] text-ink">
          Nice work.
        </h1>
        {session.feedback?.summary ? (
          <p className="mt-4 text-[1.0625rem] leading-[1.6] text-ink-soft">
            {session.feedback.summary}
          </p>
        ) : null}
      </div>

      <div className="shrink-0 sm:text-right">
        <p className="flex items-baseline gap-1.5 sm:justify-end">
          <span className="font-mono text-[3.5rem] leading-none tracking-[-0.04em] text-ink tabular-nums sm:text-[4rem]">
            {score}
          </span>
          <span className="text-[1rem] text-ink-muted">/ 100</span>
        </p>
        {delta ? (
          <p className="mt-3 text-[0.8125rem] text-ink-muted">
            {delta.direction !== "flat" ? (
              <span
                className={
                  delta.direction === "up" ? "text-ember" : "text-ink-soft"
                }
              >
                {delta.direction === "up" ? "↑" : "↓"}{" "}
              </span>
            ) : null}
            {delta.label}
          </p>
        ) : null}
      </div>
    </section>
  );
}
