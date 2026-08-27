import { Eyebrow } from "@/components/ui/Eyebrow";
import type { CoachingNote } from "@/lib/types";

export function StrengthCard({ note }: { note: CoachingNote }) {
  return (
    <section>
      <Eyebrow className="text-ink-muted">What worked</Eyebrow>
      <h3 className="mt-4 text-[1.05rem] font-medium tracking-tight text-ink">
        {note.title}
      </h3>
      <p className="mt-2 max-w-xl text-[0.95rem] leading-[1.65] text-ink-soft">
        {note.detail}
      </p>
    </section>
  );
}
