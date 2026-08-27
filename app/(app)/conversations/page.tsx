import { redirect } from "next/navigation";
import {
  DashboardSummary,
  QuestList,
} from "@/components/conversations/DashboardSummary";
import { PracticeCalendar } from "@/components/conversations/PracticeCalendar";
import { ArrowGlyph, Button } from "@/components/ui/Button";
import { TopBar } from "@/components/ui/TopBar";
import { getCurrentUser } from "@/lib/auth/server";
import {
  getDailyQuestState,
  getPerfectQuestDays,
} from "@/lib/gamification/dailyQuests";
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
  const [state, sessions, perfectDays] = await Promise.all([
    getUserGamification(user.uid).catch(() => null),
    // A year of history, so paging back through months has something to show
    // without a round trip per month.
    getRecentUserSessions(user.uid, 365).catch(() => [] as Session[]),
    getPerfectQuestDays(user.uid).catch(() => [] as string[]),
  ]);

  // Quests depend on the user document for eligibility, so this waits on the
  // read above rather than joining the batch.
  const quests = await getDailyQuestState(user.uid, dayKey, state?.doc).catch(
    () => null,
  );

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

          {/* A first-time user is exactly who benefits most from seeing what
              today is worth, so the quests show before any history exists. */}
          {quests && quests.total > 0 ? (
            <div className="mt-10">
              <QuestList quests={quests} />
            </div>
          ) : null}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[100rem] px-5 py-6 sm:px-8 lg:px-10">
      <TopBar streak={streak} />

      <div className="flex flex-col gap-7 py-7">
        {quests && state ? (
          <DashboardSummary
            displayName={user.name}
            streak={streak}
            longestStreak={state.longestStreak}
            levelProgress={state.levelProgress}
            doneToday={doneToday}
            quests={quests}
          />
        ) : null}

        <div>
          <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-ink-muted">
            Your conversations
          </h2>
          <div className="mt-3">
            <PracticeCalendar
              sessions={sessions}
              streak={streak}
              longestStreak={state?.longestStreak ?? 0}
              perfectDays={perfectDays}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
