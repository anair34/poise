import { Eyebrow } from "@/components/ui/Eyebrow";
import type { CoachingNote } from "@/lib/types";

/** The single most important thing to improve. Only ever one. */
export function CoachingOpportunity({ note }: { note: CoachingNote }) {
  return (
    <section className="border-l-2 border-ember pl-6 sm:pl-8">
      <Eyebrow>Your biggest opportunity</Eyebrow>
      <h2 className="mt-4 text-[clamp(1.5rem,3vw,1.9rem)] font-semibold leading-[1.15] tracking-[-0.03em] text-ink">
        {note.title}
      </h2>
      <p className="mt-4 max-w-xl text-[1.0625rem] leading-[1.65] text-ink-soft">
        {note.detail}
      </p>
    </section>
  );
}
