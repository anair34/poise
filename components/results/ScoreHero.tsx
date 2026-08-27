import { Eyebrow } from "@/components/ui/Eyebrow";
import { INSUFFICIENT_NOTICE } from "@/lib/scoring";
import { getScoreDelta, safeScore } from "@/lib/results";
import type { Session } from "@/lib/types";

/**
 * The score, as a number rather than a chart.
 *
 * The previous treatment was a segmented semicircular gauge, which spent a lot
 * of pixels restating a two-digit number less precisely than the digits do. A
 * large numeral reads instantly at any size, and the hairline bar underneath is
 * the only thing the gauge actually added: a sense of where 82 sits in 100.
 */
function ScoreMark({ score }: { score: number }) {
  // The width is set wide enough for a three-digit 100 at the largest step of
  // the clamp, which is the case that would otherwise wrap.
  return (
    <div className="w-full max-w-[18rem] lg:w-[20rem] lg:max-w-none">
      {/* Left-aligned when stacked, right-aligned beside the copy from lg up.
          Centring it on mobile would leave it visibly off-axis from every other
          block on the page. */}
      <p className="flex items-baseline justify-start gap-2 lg:justify-end">
        <span className="font-mono text-[clamp(4.5rem,13vw,7.5rem)] font-medium leading-[0.82] tracking-[-0.05em] tabular-nums text-ink">
          {score}
        </span>
        <span className="font-mono text-[1rem] tabular-nums text-ink-muted">
          /100
        </span>
      </p>

      <div
        className="mt-5 h-[2px] w-full overflow-hidden rounded-full bg-hairline"
        role="img"
        aria-label={`Overall score ${score} out of 100`}
      >
        <div
          className="h-full rounded-full bg-ember"
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Context for the number: how it moved, or that it is a record.
 *
 * A personal best outranks a delta — it is the rarer and better news. With
 * neither, this renders nothing rather than inventing a comparison, which is
 * the correct state for a first ever session.
 */
function ScoreContext({ session }: { session: Session }) {
  // Says plainly that the score is limited rather than dressing a capped number
  // up as a normal result. A delta or a personal best would be misleading here.
  if (session.scoringStatus === "insufficient") {
    return (
      <p className="mt-4 max-w-xs text-[0.88rem] leading-[1.5] text-ink-muted">
        {INSUFFICIENT_NOTICE}
      </p>
    );
  }

  if (session.gamification?.isPersonalBest) {
    return (
      <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-ember/30 bg-ember/[0.07] px-3.5 py-1.5 text-[0.82rem] font-medium text-ember">
        New personal best
      </p>
    );
  }

  const delta = getScoreDelta(session);
  if (!delta) return null;

  return (
    <p className="mt-4 text-[0.88rem] text-ink-soft">
      {delta.direction !== "flat" ? (
        // The arrow is decorative; the label already says up or down in words,
        // so the direction is never carried by colour or glyph alone.
        <span
          aria-hidden
          className={delta.direction === "up" ? "text-ember" : "text-ink-muted"}
        >
          {delta.direction === "up" ? "↑ " : "↓ "}
        </span>
      ) : null}
      {delta.label}
    </p>
  );
}

export function ScoreHero({ session }: { session: Session }) {
  const score = safeScore(session.overallScore);
  const isRetry = Boolean(session.retryOfSessionId);

  return (
    <section className="motion-safe:animate-rise flex flex-col items-start gap-9 lg:flex-row lg:items-end lg:justify-between lg:gap-16">
      <div className="max-w-2xl">
        <Eyebrow>
          {isRetry ? `Attempt ${session.attemptNumber ?? 2}` : "Today's session"}
        </Eyebrow>

        {/* An insufficient response should not be congratulated. The tone stays
            matter-of-fact rather than disappointed — they still showed up. */}
        <h1 className="mt-4 text-[clamp(2.4rem,5.5vw,3.6rem)] font-semibold leading-[1.02] tracking-[-0.04em] text-ink">
          {session.scoringStatus === "insufficient"
            ? "That was a short one."
            : "Nice work."}
        </h1>

        {session.feedback?.summary ? (
          <p className="mt-4 max-w-xl text-[clamp(1.05rem,1.6vw,1.2rem)] leading-[1.6] text-ink-soft">
            {session.feedback.summary}
          </p>
        ) : null}

        <p className="mt-5 text-[0.78rem] font-medium uppercase tracking-[0.16em] text-ink-muted">
          {session.category}
        </p>
      </div>

      {/* Stacks under the summary on mobile, sits beside it from lg up. */}
      <div className="w-full lg:w-auto lg:shrink-0 lg:text-right">
        <ScoreMark score={score} />
        <ScoreContext session={session} />
      </div>
    </section>
  );
}
