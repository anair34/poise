import { notFound, redirect } from "next/navigation";
import { BeatYourScore } from "@/components/results/BeatYourScore";
import { CoachingOpportunity } from "@/components/results/CoachingOpportunity";
import { ResultActions } from "@/components/results/ResultActions";
import { RetryComparison } from "@/components/results/RetryComparison";
import { RewriteCard } from "@/components/results/RewriteCard";
import { ScoreBreakdown } from "@/components/results/ScoreBreakdown";
import { ScoreHero } from "@/components/results/ScoreHero";
import { SessionRewards } from "@/components/results/SessionRewards";
import { SpeechMetrics } from "@/components/results/SpeechMetrics";
import { StrengthCard } from "@/components/results/StrengthCard";
import { TranscriptDisclosure } from "@/components/results/TranscriptDisclosure";
import { TopBar } from "@/components/ui/TopBar";
import { getCurrentUser } from "@/lib/auth/server";
import { buildRetryComparison } from "@/lib/gamification/retry";
import { safeScore, toScoreRows } from "@/lib/results";
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

  // A retry compares against the attempt it was measured against. Loaded
  // owner-scoped like everything else, and a missing parent degrades to an
  // ordinary result rather than an error.
  const parent = session.retryOfSessionId
    ? await loadSession(session.retryOfSessionId, user.uid)
    : null;
  const comparison = parent ? buildRetryComparison(parent, session) : null;

  return (
    // Narrower than the practice and calendar pages on purpose: this one is
    // read rather than scanned, and a 100rem measure makes prose unreadable.
    <main className="mx-auto w-full max-w-[72rem] px-5 py-6 sm:px-8">
      <TopBar streak={session.streak} />

      {/* Rhythm rather than uniform cards: the hero, breakdown, strength and
          transcript sit open on the paper, so the three white surfaces that
          remain — coaching, retry, rewrite — are the ones that carry weight. */}
      <div className="flex flex-col gap-14 py-10 sm:gap-16">
        <ScoreHero session={session} />

        {feedback?.opportunity ? (
          <CoachingOpportunity note={feedback.opportunity} />
        ) : null}

        <div className="flex flex-col gap-7">
          <ScoreBreakdown rows={toScoreRows(session)} />
          <SpeechMetrics metrics={session.metrics} />
        </div>

        {session.gamification ? (
          <SessionRewards
            gamification={session.gamification}
            streak={session.streak}
          />
        ) : null}

        {/* A retry earns its comparison before being asked to go again. */}
        {comparison ? (
          <RetryComparison
            comparison={comparison}
            attemptNumber={session.attemptNumber ?? 2}
          />
        ) : null}

        <BeatYourScore
          sessionId={session.id}
          promptId={session.promptId}
          scoreToBeat={safeScore(session.overallScore)}
          focus={feedback?.opportunity?.title}
        />

        {feedback?.strength ? <StrengthCard note={feedback.strength} /> : null}

        {feedback?.rewrite ? <RewriteCard rewrite={feedback.rewrite} /> : null}

        {session.transcript ? (
          <TranscriptDisclosure
            transcript={session.transcript}
            prompt={session.promptText}
          />
        ) : null}

        <ResultActions
          promptId={session.promptId}
          encouragement={feedback?.encouragement}
        />
      </div>
    </main>
  );
}
