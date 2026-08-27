import { Eyebrow } from "@/components/ui/Eyebrow";
import type { CoachingNote } from "@/lib/types";

/**
 * The single most important thing to improve. Only ever one.
 *
 * This is the page's centre of gravity, so it is the one block that gets a full
 * white surface and the largest type below the score itself. Everything after it
 * is supporting evidence — putting this beside an equally weighted card was the
 * main thing that made the old page read as a report rather than coaching.
 */
export function CoachingOpportunity({ note }: { note: CoachingNote }) {
  return (
    <section className="motion-safe:animate-rise relative overflow-hidden rounded-3xl border border-hairline bg-canvas px-6 py-8 sm:px-10 sm:py-11">
      {/* A single ember rule, rather than a tinted panel or a gradient. */}
      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-ember" />

      <Eyebrow>Your biggest opportunity</Eyebrow>

      <h2 className="mt-5 max-w-3xl text-[clamp(1.7rem,3.6vw,2.6rem)] font-semibold leading-[1.08] tracking-[-0.035em] text-ink">
        {note.title}
      </h2>

      <p className="mt-4 max-w-2xl text-[clamp(1.05rem,1.6vw,1.2rem)] leading-[1.65] text-ink-soft">
        {note.detail}
      </p>

      <p className="mt-7 inline-flex items-center gap-2 rounded-full border border-hairline bg-paper px-3.5 py-1.5 text-[0.76rem] font-medium text-ink-muted">
        Focus on this next time
      </p>
    </section>
  );
}
