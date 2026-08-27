import { formatDuration } from "@/lib/results";
import type { SpeechMetrics as Metrics } from "@/lib/types";

function safeCount(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.round(numeric)) : 0;
}

/**
 * A tiny bar row standing in for the measurement's position in a healthy band.
 * Deliberately unlabelled: it is a texture cue, and the number beside it is the
 * actual claim.
 */
function Ticks({ filled }: { filled: number }) {
  return (
    <div aria-hidden className="mt-3 flex gap-[3px]">
      {Array.from({ length: 8 }, (_, index) => (
        <span
          key={index}
          className={
            index < filled
              ? "h-2.5 w-[3px] rounded-full bg-ember/70"
              : "h-2.5 w-[3px] rounded-full bg-hairline"
          }
        />
      ))}
    </div>
  );
}

export function SpeechMetrics({ metrics }: { metrics: Metrics }) {
  const wpm = safeCount(metrics?.wordsPerMinute);
  const fillers = safeCount(metrics?.fillerWordCount);
  const words = safeCount(metrics?.wordCount);
  const seconds = safeCount(metrics?.durationSeconds);

  const items = [
    {
      value: String(wpm),
      unit: "WPM",
      label: "Pace",
      // 140–160 wpm is the comfortable middle of conversational speech.
      filled: Math.min(8, Math.round((wpm / 200) * 8)),
    },
    {
      value: String(fillers),
      unit: fillers === 1 ? "filler" : "fillers",
      label: "Filler words",
      filled: Math.max(0, 8 - Math.min(8, fillers)),
    },
    {
      value: formatDuration(seconds),
      unit: "elapsed",
      label: "Duration",
      filled: Math.min(8, Math.round((seconds / 60) * 8)),
    },
    {
      value: String(words),
      unit: "words",
      label: "Length",
      filled: Math.min(8, Math.round((words / 160) * 8)),
    },
  ];

  return (
    <section
      aria-label="Speech metrics"
      className="grid grid-cols-2 gap-3 xl:grid-cols-4"
    >
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl border border-hairline bg-canvas px-4 py-4"
        >
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-ink-muted">
            {item.label}
          </p>
          <p className="mt-2.5 flex items-baseline gap-1.5">
            <span className="font-mono text-[1.5rem] leading-none tabular-nums text-ink">
              {item.value}
            </span>
            <span className="text-[0.75rem] text-ink-muted">{item.unit}</span>
          </p>
          <Ticks filled={item.filled} />
        </div>
      ))}
    </section>
  );
}
