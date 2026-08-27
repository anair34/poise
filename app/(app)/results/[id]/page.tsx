import { notFound, redirect } from "next/navigation";
import { CoachingOpportunity } from "@/components/results/CoachingOpportunity";
import { ResultActions } from "@/components/results/ResultActions";
import { RewriteCard } from "@/components/results/RewriteCard";
import { ScoreBreakdown } from "@/components/results/ScoreBreakdown";
import { ScoreHero } from "@/components/results/ScoreHero";
import { SpeechMetrics } from "@/components/results/SpeechMetrics";
import { StrengthCard } from "@/components/results/StrengthCard";
import { TranscriptDisclosure } from "@/components/results/TranscriptDisclosure";
import { TopBar } from "@/components/ui/TopBar";
import { getCurrentUser } from "@/lib/auth/server";
import { toScoreRows } from "@/lib/results";
import { getSessionForUser } from "@/lib/sessions";

export const metadata = {
  title: "Your session — Poise",
};

export const dynamic = "force-dynamic";

/** A read failure should look like a missing session, not a crashed page. */
async function loadSession(id: string, uid: string) {
  try {
    return await getSessionForUser(id, uid);
  } catch (caught) {
    console.error("[results] failed to load session:", caught);
    return null;
  }
}

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Middleware already bounced visitors with no cookie, but it cannot verify
  // one. This is the check that actually holds.
  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    redirect(`/signin?next=${encodeURIComponent(`/results/${id}`)}`);
  }

  // Returns null for someone else's session as well as a missing one, so this
  // reveals nothing about which ids exist.
  const session = await loadSession(id, user.uid);
  if (!session) notFound();

  const { feedback } = session;

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-7 sm:px-7 sm:py-9">
      <TopBar streak={session.streak} />

      <div className="flex flex-col gap-14 py-14 sm:gap-16 sm:py-16">
        <ScoreHero session={session} />

        <ScoreBreakdown rows={toScoreRows(session)} />

        {feedback?.opportunity ? (
          <CoachingOpportunity note={feedback.opportunity} />
        ) : null}

        {feedback?.strength ? <StrengthCard note={feedback.strength} /> : null}

        {feedback?.rewrite ? <RewriteCard rewrite={feedback.rewrite} /> : null}

        <div className="flex flex-col gap-8">
          <SpeechMetrics metrics={session.metrics} />
          {session.transcript ? (
            <TranscriptDisclosure
              transcript={session.transcript}
              prompt={session.promptText}
            />
          ) : null}
        </div>

        <ResultActions
          promptId={session.promptId}
          encouragement={feedback?.encouragement}
        />
      </div>
    </main>
  );
}
