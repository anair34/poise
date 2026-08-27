import type { ScoreRow } from "@/lib/results";

/**
 * The four dimensions as hairline-separated rows, open on the paper background.
 *
 * Deliberately not four cards. Cards would give each dimension the same visual
 * weight as the coaching block above, and the whole point of this section is
 * that it is evidence for that block rather than a rival to it.
 */
export function ScoreBreakdown({ rows }: { rows: ScoreRow[] }) {
  return (
    <section aria-label="Score breakdown">
      <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-ink-muted">
        How it scored
      </h2>

      <div className="mt-2 divide-y divide-hairline border-t border-hairline">
        {rows.map((row) => (
          <div key={row.key} className="py-5">
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-[1rem] font-medium tracking-tight text-ink">
                {row.label}
              </p>
              <p className="font-mono text-[1.05rem] tabular-nums text-ink">
                {row.value}
              </p>
            </div>

            <div
              className="mt-3 h-[2px] w-full overflow-hidden rounded-full bg-hairline"
              role="img"
              aria-label={`${row.label} ${row.value} out of 100`}
            >
              <div
                className="h-full rounded-full bg-ember/75"
                style={{ width: `${row.value}%` }}
              />
            </div>

            {row.note ? (
              <p className="mt-3 max-w-2xl text-[0.92rem] leading-[1.6] text-ink-soft">
                {row.note}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
