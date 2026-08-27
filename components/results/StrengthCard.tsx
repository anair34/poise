import { Eyebrow } from "@/components/ui/Eyebrow";
import type { CoachingNote } from "@/lib/types";

export function StrengthCard({ note }: { note: CoachingNote }) {
  return (
    <section className="rounded-2xl border border-hairline bg-paper px-6 py-6 sm:px-8">
      <Eyebrow className="text-ink-muted">What worked</Eyebrow>
      <h3 className="mt-3.5 text-[1.05rem] font-medium tracking-tight text-ink">
        {note.title}
      </h3>
      <p className="mt-2 text-[0.95rem] leading-[1.65] text-ink-soft">
        {note.detail}
      </p>
    </section>
  );
}
