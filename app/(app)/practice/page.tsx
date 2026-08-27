import { Recorder } from "@/components/practice/Recorder";
import { TopBar } from "@/components/ui/TopBar";
import { getCurrentUser } from "@/lib/auth/server";
import { getDailyPromptForDay, resolvePromptById } from "@/lib/dailyPrompts";
import { getLibraryPrompt } from "@/lib/prompts";
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
  searchParams: Promise<{ prompt?: string }>;
}) {
  const { prompt: requestedId } = await searchParams;
  const dayKey = toDayKey();

  const user = await getCurrentUser().catch(() => null);

  // ?prompt=<id> lets the results page offer a retry or a fresh challenge.
  // A failed lookup falls back to the library rather than blocking practice,
  // which is the one thing this page exists to allow.
  let prompt;
  try {
    prompt =
      (requestedId ? await resolvePromptById(requestedId) : undefined) ??
      (await getDailyPromptForDay(dayKey));
  } catch (caught) {
    console.error("[practice] could not load prompt:", caught);
    prompt = getLibraryPrompt(0);
  }

  const state = user
    ? await getUserGamification(user.uid).catch(() => null)
    : null;

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
        <Recorder prompt={prompt} streak={streak} isSignedIn={Boolean(user)} />
      </div>
    </main>
  );
}
