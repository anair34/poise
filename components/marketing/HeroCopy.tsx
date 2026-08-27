import { ArrowGlyph, Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";

export function HeroCopy() {
  return (
    <div className="max-w-[30rem]">
      <Eyebrow>Poise</Eyebrow>

      <h1 className="mt-6 text-[clamp(2.4rem,5.2vw,3.75rem)] font-semibold leading-[1.04] tracking-[-0.035em] text-ink">
        Speak better.
        <br />
        One minute at a time.
      </h1>

      <p className="mt-6 max-w-[26rem] text-[1.0625rem] leading-[1.6] text-ink-soft">
        Build clarity, confidence, and presence through one daily speaking
        exercise and personalized AI feedback.
      </p>

      <div className="mt-9">
        <Button href="/practice">
          Start today&apos;s challenge <ArrowGlyph />
        </Button>
      </div>
    </div>
  );
}
