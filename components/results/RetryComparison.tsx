import { cn } from "@/lib/cn";
import type {
  ComparisonRow,
  RetryComparison as Comparison,
} from "@/lib/gamification/retry";

function formatValue(value: number, format: ComparisonRow["format"]): string {
  if (format === "percent") return `${value}%`;
  if (format === "decimal") return value.toFixed(1);
  return String(value);
}

/**
 * The change, signed.
 *
 * Only genuine improvements get ember, and only on the overall row and clear
 * gains — colouring every number would turn the table into a scoreboard of
 * wins and losses. A worse number stays in muted ink rather than going red:
 * this is practice, and a take that did not land is information, not an error.
 */
function Delta({ row }: { row: ComparisonRow }) {
  if (row.improved === null) {
    return <span className="text-[0.8rem] text-ink-muted">—</span>;
  }
  if (row.delta === 0) {
    return <span className="text-[0.8rem] text-ink-muted">even</span>;
  }

  return (
    <span
      className={cn(
        "font-mono text-[0.9rem] tabular-nums",
        row.improved ? "text-ember" : "text-ink-muted",
      )}
    >
      {row.delta > 0 ? "+" : "−"}
      {formatValue(Math.abs(row.delta), row.format)}
    </span>
  );
}

/**
 * One row. On mobile the label sits on its own line above the numbers, so three
 * columns never have to share a narrow viewport — no horizontal scrolling and
 * no shrunken type.
 */
function Row({ row, emphasis }: { row: ComparisonRow; emphasis?: boolean }) {
  return (
    <div className="flex flex-col gap-1 py-3.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <p
        className={cn(
          "text-ink",
          emphasis ? "text-[1rem] font-medium" : "text-[0.92rem]",
        )}
      >
        {row.label}
      </p>

      <div className="flex items-baseline gap-6 sm:gap-8">
        <span className="w-10 text-right font-mono text-[0.92rem] tabular-nums text-ink-muted">
          {formatValue(row.before, row.format)}
        </span>
        <span
          className={cn(
            "w-12 text-right font-mono tabular-nums text-ink",
            emphasis ? "text-[1.2rem]" : "text-[0.98rem]",
          )}
        >
          {formatValue(row.after, row.format)}
        </span>
        <span className="w-12 text-right">
          <Delta row={row} />
        </span>
      </div>
    </div>
  );
}

function ColumnHeadings() {
  return (
    <div
      aria-hidden
      // Rows stack their label above the numbers on mobile, which pushes the
      // numbers to the left edge — so the headings have to follow them there or
      // they would sit over the wrong columns.
      className="flex items-baseline justify-start gap-6 pb-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-ink-muted sm:justify-end sm:gap-8"
    >
      <span className="w-10 text-right">Before</span>
      <span className="w-12 text-right">Retry</span>
      <span className="w-12 text-right" />
    </div>
  );
}

export function RetryComparison({
  comparison,
  attemptNumber,
}: {
  comparison: Comparison;
  attemptNumber: number;
}) {
  const [overall, ...dimensions] = comparison.scores;
  const gain = comparison.biggestImprovement;

  return (
    <section className="motion-safe:animate-rise rounded-3xl border border-hairline bg-canvas px-6 py-8 sm:px-10 sm:py-10">
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-ember">
        {comparison.beatOriginal ? "You beat your score" : "One more try"}
      </p>

      <h2 className="mt-4 max-w-2xl text-[clamp(1.5rem,3vw,2.1rem)] font-semibold leading-[1.1] tracking-[-0.035em] text-ink">
        {comparison.beatOriginal
          ? `Attempt ${attemptNumber} came out ${comparison.overallDelta} points ahead.`
          : "This one didn't land — the reps still count."}
      </h2>

      <div className="mt-8">
        <ColumnHeadings />
        <div className="divide-y divide-hairline border-t border-hairline">
          <Row row={overall} emphasis />
          {dimensions.map((row) => (
            <Row key={row.label} row={row} />
          ))}
        </div>
      </div>

      {gain ? (
        <p className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-[0.74rem] uppercase tracking-[0.14em] text-ink-muted">
            Biggest gain
          </span>
          <span className="text-[1rem] text-ink">
            {gain.label}{" "}
            <span className="font-mono tabular-nums text-ember">
              +{gain.delta}
            </span>
          </span>
        </p>
      ) : null}

      <div className="mt-8 border-t border-hairline pt-6">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-ink-muted">
          Measured
        </p>
        <div className="mt-1 divide-y divide-hairline">
          {comparison.metrics.map((row) => (
            <Row key={row.label} row={row} />
          ))}
        </div>
        <p className="mt-4 text-[0.8rem] leading-[1.55] text-ink-muted">
          Pace is shown without a verdict — faster isn&apos;t better and neither
          is slower.
        </p>
      </div>
    </section>
  );
}
