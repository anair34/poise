import { ArrowGlyph, Button } from "@/components/ui/Button";
import { GoogleGlyph } from "@/components/ui/GoogleGlyph";

export function HeroCopy() {
  return (
    <div className="max-w-[30rem]">
      <h1 className="text-[clamp(2.4rem,5.2vw,3.75rem)] font-semibold leading-[1.04] tracking-[-0.035em] text-ink">
        Speak better.
        <br />
        One minute at a time.
      </h1>

      <p className="mt-6 max-w-[26rem] text-[1.0625rem] leading-[1.6] text-ink-soft">
        One daily speaking exercise, and honest feedback on how you said it.
      </p>

      <div className="mt-9 flex flex-wrap items-center gap-3">
        <Button href="/signup" variant="ghost">
          <GoogleGlyph />
          Get started with Google
        </Button>
        <Button href="/practice">
          Try practicing now! <ArrowGlyph />
        </Button>
      </div>
    </div>
  );
}
