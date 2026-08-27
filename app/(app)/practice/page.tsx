import { Recorder } from "@/components/practice/Recorder";
import type { RetryContext } from "@/components/practice/RetryBanner";
import { TopBar } from "@/components/ui/TopBar";
import { getCurrentUser } from "@/lib/auth/server";
import { getDailyPromptForDay, resolvePromptById } from "@/lib/dailyPrompts";
import { getLibraryPrompt } from "@/lib/prompts";
import { safeScore } from "@/lib/results";
import { getSessionForUser } from "@/lib/sessions";
import { toDayKey, visibleStreak } from "@/lib/streaks";
import { getUserGamification } from "@/lib/users";

export const metadata = {
  title: "Today's challenge — Poise",
};

// The challenge changes daily and the streak changes per session, so nothing on
// this page should be cached between requests.
export const dynamic = "force-dynamic";

export default async function PracticePage({
  searchParams,
}: {
  searchParams: Promise<{ prompt?: string; retryOf?: string }>;
}) {
  const { prompt: requestedId, retryOf } = await searchParams;
  const dayKey = toDayKey();

  const user = await getCurrentUser().catch(() => null);

  // The retry target is resolved before the prompt, because a retry must answer
  // the *same* prompt — deriving it from the parent rather than the URL means a
  // hand-edited link cannot turn a retry into a different question.
  //
  // The lookup is owner-scoped, so naming someone else's session id yields
  // nothing and the page renders as an ordinary attempt.
  const parent =
    user && retryOf
      ? await getSessionForUser(retryOf, user.uid).catch(() => null)
      : null;

  // ?prompt=<id> lets the results page offer a retry or a fresh challenge.
  // A failed lookup falls back to the library rather than blocking practice,
  // which is the one thing this page exists to allow.
  let prompt;
  try {
    const promptId = parent?.promptId ?? requestedId;
    prompt =
      (promptId ? await resolvePromptById(promptId) : undefined) ??
      (await getDailyPromptForDay(dayKey));
  } catch (caught) {
    console.error("[practice] could not load prompt:", caught);
    prompt = getLibraryPrompt(0);
  }

  const state = user
    ? await getUserGamification(user.uid).catch(() => null)
    : null;

  const retry: RetryContext | undefined = parent
    ? {
        sessionId: parent.id,
        attemptNumber: (parent.attemptNumber ?? 1) + 1,
        scoreToBeat: safeScore(parent.overallScore),
        focus: parent.feedback?.opportunity?.title,
      }
    : undefined;

  const streak = state
    ? visibleStreak(
        {
          currentStreak: state.currentStreak,
          longestStreak: state.longestStreak,
          lastPracticeDay: state.lastPracticeDate,
          daysPracticed: state.totalPracticeDays,
        },
        dayKey,
      )
    : 0;

  return (
    <main className="mx-auto w-full max-w-[100rem] px-5 py-6 sm:px-8 lg:px-10">
      <TopBar streak={streak} />
      <div className="py-8">
        <Recorder
          prompt={prompt}
          streak={streak}
          isSignedIn={Boolean(user)}
          retry={retry}
        />
      </div>
    </main>
  );
}
