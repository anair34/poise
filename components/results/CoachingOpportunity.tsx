import { Eyebrow } from "@/components/ui/Eyebrow";
import type { CoachingNote } from "@/lib/types";

/** The single most important thing to improve. Only ever one. */
export function CoachingOpportunity({ note }: { note: CoachingNote }) {
  return (
    <section className="flex-1 rounded-2xl border border-hairline border-l-2 border-l-ember bg-canvas px-6 py-6 sm:px-8">
      <Eyebrow>Your biggest opportunity</Eyebrow>
      <h2 className="mt-3.5 text-[clamp(1.4rem,2.4vw,1.8rem)] font-semibold leading-[1.15] tracking-[-0.03em] text-ink">
        {note.title}
      </h2>
      <p className="mt-3 text-[1.0625rem] leading-[1.65] text-ink-soft">
        {note.detail}
      </p>
    </section>
  );
}
