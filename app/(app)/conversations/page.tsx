import { redirect } from "next/navigation";
import { PracticeCalendar } from "@/components/conversations/PracticeCalendar";
import { ArrowGlyph, Button } from "@/components/ui/Button";
import { TopBar } from "@/components/ui/TopBar";
import { getCurrentUser } from "@/lib/auth/server";
import { getRecentUserSessions } from "@/lib/sessions";
import { toDayKey, visibleStreak } from "@/lib/streaks";
import { getUserGamification } from "@/lib/users";
import type { Session } from "@/lib/types";

export const metadata = {
  title: "Your conversations — Poise",
};

export const dynamic = "force-dynamic";

export default async function ConversationsPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/signin?next=%2Fconversations");

  const dayKey = toDayKey();
  const [state, sessions] = await Promise.all([
    getUserGamification(user.uid).catch(() => null),
    // A year of history, so paging back through months has something to show
    // without a round trip per month.
    getRecentUserSessions(user.uid, 365).catch(() => [] as Session[]),
  ]);

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
  const doneToday = state?.lastCompletedChallengeDate === dayKey;

  if (sessions.length === 0) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-5 py-7 sm:px-7 sm:py-9">
        <TopBar streak={streak} />
        <div className="flex flex-1 flex-col justify-center py-16">
          <h1 className="text-[clamp(1.9rem,4vw,2.5rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-ink">
            Your first session starts the story.
          </h1>
          <p className="mt-4 max-w-md text-[1.0625rem] leading-[1.6] text-ink-soft">
            Every response you record lands here, so you can come back and read
            what you said and how it landed.
          </p>
          <div className="mt-9">
            <Button href="/practice">
              Today&apos;s challenge <ArrowGlyph />
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[100rem] px-5 py-6 sm:px-8 lg:px-10">
      <TopBar streak={streak} />

      <div className="py-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-[clamp(1.7rem,3vw,2.2rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-ink">
            Everything you&apos;ve said out loud.
          </h1>
          <Button href="/practice">
            {doneToday ? "Practice again" : "Today's challenge"} <ArrowGlyph />
          </Button>
        </div>

        <div className="mt-7">
          <PracticeCalendar sessions={sessions} />
        </div>
      </div>
    </main>
  );
}
