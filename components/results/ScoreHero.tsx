import { ScoreGauge } from "./ScoreGauge";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { getScoreDelta, safeScore } from "@/lib/results";
import type { Session } from "@/lib/types";

export function ScoreHero({ session }: { session: Session }) {
  const score = safeScore(session.overallScore);
  const delta = getScoreDelta(session);

  return (
    <section className="flex flex-col-reverse items-center gap-8 rounded-2xl border border-hairline bg-canvas px-6 py-7 sm:px-9 lg:flex-row lg:items-center lg:justify-between lg:gap-12 lg:py-8">
      <div className="max-w-xl text-center lg:text-left">
        <Eyebrow>Today&apos;s session</Eyebrow>
        <h1 className="mt-4 text-[clamp(2.1rem,4vw,3rem)] font-semibold leading-[1.05] tracking-[-0.035em] text-ink">
          Nice work.
        </h1>
        {session.feedback?.summary ? (
          <p className="mt-3 text-[1.0625rem] leading-[1.6] text-ink-soft">
            {session.feedback.summary}
          </p>
        ) : null}
        <p className="mt-4 text-[0.85rem] text-ink-muted">
          <span className="text-ink-soft">{session.category}</span>
          {delta ? (
            <>
              {" · "}
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
            </>
          ) : null}
        </p>
      </div>

      <ScoreGauge score={score} className="shrink-0" />
    </section>
  );
}
