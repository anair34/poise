import { formatDuration } from "@/lib/results";
import type { SpeechMetrics as Metrics } from "@/lib/types";

function safeCount(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.round(numeric)) : 0;
}

/**
 * A plain descriptive word for pace, or nothing.
 *
 * Deliberately descriptive rather than evaluative: "Fast" is an observation, and
 * the scoring model — not this strip — is what decides whether fast was a
 * problem for this particular answer. The middle band gets no label at all,
 * because "Normal" is noise.
 */
function paceNote(wpm: number): string | null {
  if (wpm === 0) return null;
  if (wpm < 110) return "Measured";
  if (wpm > 180) return "Fast";
  return null;
}

/**
 * The deterministic measurements, as one compact line.
 *
 * These are facts, not verdicts, so they get secondary typography and no cards.
 * Four equal boxes gave them the same presence as the coaching, which is the
 * opposite of the priority the page is trying to communicate.
 */
export function SpeechMetrics({ metrics }: { metrics: Metrics }) {
  const wpm = safeCount(metrics?.wordsPerMinute);
  const fillers = safeCount(metrics?.fillerWordCount);
  const words = safeCount(metrics?.wordCount);
  const seconds = safeCount(metrics?.durationSeconds);

  const items = [
    { value: String(wpm), unit: "WPM", note: paceNote(wpm), label: "Pace" },
    {
      value: String(fillers),
      unit: fillers === 1 ? "filler" : "fillers",
      note: null,
      label: "Filler words",
    },
    {
      value: formatDuration(seconds),
      unit: null,
      note: null,
      label: "Duration",
    },
    { value: String(words), unit: "words", note: null, label: "Length" },
  ];

  return (
    <section aria-label="Speech metrics">
      <dl className="flex flex-wrap items-baseline gap-x-8 gap-y-3 border-t border-hairline pt-5 sm:gap-x-12">
        {items.map((item) => (
          <div key={item.label} className="flex items-baseline gap-2">
            <dt className="sr-only">{item.label}</dt>
            <dd className="flex items-baseline gap-1.5">
              <span className="font-mono text-[1.05rem] tabular-nums text-ink">
                {item.value}
              </span>
              {item.unit ? (
                <span className="text-[0.85rem] text-ink-muted">
                  {item.unit}
                </span>
              ) : null}
              {item.note ? (
                <span className="ml-1 text-[0.78rem] text-ink-muted">
                  {item.note}
                </span>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
