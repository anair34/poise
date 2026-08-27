import { formatDuration } from "@/lib/results";
import type { SpeechMetrics as Metrics } from "@/lib/types";

function safeCount(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.round(numeric)) : 0;
}

export function SpeechMetrics({ metrics }: { metrics: Metrics }) {
  const items = [
    { value: `${safeCount(metrics?.wordsPerMinute)}`, unit: "WPM" },
    { value: `${safeCount(metrics?.fillerWordCount)}`, unit: "fillers" },
    { value: formatDuration(metrics?.durationSeconds), unit: "duration" },
    { value: `${safeCount(metrics?.wordCount)}`, unit: "words" },
  ];

  return (
    <section
      aria-label="Speech metrics"
      className="flex flex-wrap gap-x-8 gap-y-4 border-y border-hairline py-5"
    >
      {items.map((item) => (
        <p key={item.unit} className="flex items-baseline gap-1.5">
          <span className="font-mono text-[1.05rem] tabular-nums text-ink">
            {item.value}
          </span>
          <span className="text-[0.8rem] text-ink-muted">{item.unit}</span>
        </p>
      ))}
    </section>
  );
}
