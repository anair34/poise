export interface RetryContext {
  sessionId: string;
  attemptNumber: number;
  scoreToBeat: number;
  /** The coaching note from the attempt being beaten, if there was one. */
  focus?: string;
}

/**
 * The "beat your score" header on a retry.
 *
 * Kept quiet on purpose. The number to beat is useful before you start and a
 * distraction while you are speaking, so it states the target once and does not
 * animate, pulse, or otherwise ask for attention.
 */
export function RetryBanner({ retry }: { retry: RetryContext }) {
  return (
    <div className="mb-4 flex flex-wrap items-baseline gap-x-8 gap-y-3 rounded-2xl border border-hairline bg-canvas px-6 py-4 sm:px-8">
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-ember">
        Attempt {retry.attemptNumber}
      </p>

      <p className="flex items-baseline gap-2">
        <span className="text-[0.72rem] uppercase tracking-[0.14em] text-ink-muted">
          Score to beat
        </span>
        <span className="font-mono text-[1.4rem] tabular-nums leading-none text-ink">
          {retry.scoreToBeat}
        </span>
      </p>

      {retry.focus ? (
        <p className="flex min-w-0 items-baseline gap-2">
          <span className="shrink-0 text-[0.72rem] uppercase tracking-[0.14em] text-ink-muted">
            Focus on
          </span>
          <span className="truncate text-[0.9rem] text-ink-soft">
            {retry.focus}
          </span>
        </p>
      ) : null}
    </div>
  );
}
