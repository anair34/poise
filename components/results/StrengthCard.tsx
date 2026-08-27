import type { CoachingNote } from "@/lib/types";

/**
 * What went well.
 *
 * Open on the paper background with no card, because it has to read as clearly
 * secondary to the improvement block above. Removing the surface is what does
 * that; shrinking the type alone would just make it look neglected.
 */
export function StrengthCard({ note }: { note: CoachingNote }) {
  return (
    <section className="max-w-2xl">
      <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-ink-muted">
        What worked
      </h2>
      <h3 className="mt-3 text-[1.15rem] font-medium tracking-tight text-ink">
        {note.title}
      </h3>
      <p className="mt-2 text-[0.98rem] leading-[1.65] text-ink-soft">
        {note.detail}
      </p>
    </section>
  );
}
