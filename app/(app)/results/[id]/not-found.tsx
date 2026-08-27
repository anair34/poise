import { ArrowGlyph, Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { TopBar } from "@/components/ui/TopBar";

export default function SessionNotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-5 py-7 sm:px-7 sm:py-9">
      <TopBar />
      <div className="flex flex-1 flex-col justify-center py-16">
        <Eyebrow>Session not found</Eyebrow>
        <h1 className="mt-5 text-[clamp(1.9rem,4vw,2.5rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-ink">
          We couldn&apos;t find that session.
        </h1>
        <p className="mt-4 max-w-md text-[1.0625rem] leading-[1.6] text-ink-soft">
          Sessions from a previous run of the app aren&apos;t saved yet. Record
          a new response and your feedback will be waiting here.
        </p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Button href="/practice">
            Start today&apos;s challenge <ArrowGlyph />
          </Button>
          <Button href="/" variant="ghost">
            Back to home
          </Button>
        </div>
      </div>
    </main>
  );
}
