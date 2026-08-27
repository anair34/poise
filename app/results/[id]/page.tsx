import { notFound } from "next/navigation";
import { ArrowGlyph, Button } from "@/components/ui/Button";
import { Wordmark } from "@/components/marketing/Wordmark";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { getSession } from "@/lib/sessionStore";

/**
 * Placeholder results view so the record → analyze → results loop completes.
 * The full coaching layout is the next build step.
 */
export default async function ResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = getSession(id);
  if (!session) notFound();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-5 py-8 sm:px-7 sm:py-10">
      <Wordmark />
      <div className="flex flex-1 flex-col justify-center py-10">
        <Eyebrow>Day {session.dayNumber} complete</Eyebrow>
        <p className="mt-6 font-mono text-[4rem] leading-none tracking-tight text-ink">
          {session.overallScore}
          <span className="text-[1.25rem] text-ink-muted">/100</span>
        </p>
        <p className="mt-6 max-w-md text-[1.0625rem] leading-[1.6] text-ink-soft">
          {session.feedback.strength}
        </p>
        <p className="mt-3 max-w-md text-[1.0625rem] leading-[1.6] text-ink-soft">
          {session.feedback.opportunity}
        </p>
        <p className="mt-6 text-[0.8125rem] text-ink-muted">
          {session.metrics.durationSeconds}s ·{" "}
          {session.metrics.wordsPerMinute} wpm ·{" "}
          {session.metrics.fillerWordCount} filler words · {session.streak} day
          streak
        </p>
        <div className="mt-9">
          <Button href="/practice" variant="ghost">
            Practice again <ArrowGlyph />
          </Button>
        </div>
      </div>
    </main>
  );
}
