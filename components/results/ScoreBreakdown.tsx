import type { ScoreRow } from "@/lib/results";

export function ScoreBreakdown({ rows }: { rows: ScoreRow[] }) {
  return (
    <section aria-label="Score breakdown" className="divide-y divide-hairline">
      {rows.map((row) => (
        <div key={row.key} className="grid grid-cols-[1fr_auto] gap-x-4 py-5">
          <p className="text-[0.95rem] font-medium tracking-tight text-ink">
            {row.label}
          </p>
          <p className="font-mono text-[0.95rem] tabular-nums text-ink">
            {row.value}
          </p>

          <div
            className="col-span-2 mt-3 h-[3px] w-full overflow-hidden rounded-full bg-hairline"
            role="img"
            aria-label={`${row.label} ${row.value} out of 100`}
          >
            <div
              className="h-full rounded-full bg-ember/80"
              style={{ width: `${row.value}%` }}
            />
          </div>

          {row.note ? (
            <p className="col-span-2 mt-2.5 text-[0.85rem] leading-relaxed text-ink-muted">
              {row.note}
            </p>
          ) : null}
        </div>
      ))}
    </section>
  );
}
