import Link from "next/link";
import { ArrowGlyph, Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { LevelProgress } from "@/lib/gamification/levels";
import type { DailyQuestState } from "@/lib/gamification/dailyQuests";

function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-hairline bg-canvas px-6 py-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-ink-muted">
      {children}
    </p>
  );
}

function StreakCard({
  streak,
  longestStreak,
}: {
  streak: number;
  longestStreak: number;
}) {
  return (
    <Card>
      <Label>Streak</Label>
      <p className="mt-2.5 flex items-baseline gap-2">
        <span aria-hidden className="text-[1.3rem]">
          🔥
        </span>
        <span className="font-mono text-[2rem] leading-none tabular-nums text-ink">
          {streak}
        </span>
        <span className="text-[0.85rem] text-ink-muted">
          {streak === 1 ? "day" : "days"}
        </span>
      </p>
      <p className="mt-2.5 text-[0.78rem] text-ink-muted">
        Longest {longestStreak} {longestStreak === 1 ? "day" : "days"}
      </p>
    </Card>
  );
}

function LevelCard({ progress }: { progress: LevelProgress }) {
  return (
    <Card>
      <Label>Level</Label>
      <p className="mt-2.5 flex items-baseline gap-2">
        <span className="font-mono text-[2rem] leading-none tabular-nums text-ink">
          {progress.level}
        </span>
        <span className="font-mono text-[0.85rem] tabular-nums text-ink-muted">
          {progress.totalXp} / {progress.nextLevelXp} XP
        </span>
      </p>
      <div
        className="mt-3 h-[4px] w-full overflow-hidden rounded-full bg-hairline"
        role="img"
        aria-label={`${progress.xpIntoLevel} of ${progress.xpForLevel} XP toward level ${progress.level + 1}`}
      >
        <div
          className="h-full rounded-full bg-ember transition-[width] duration-500"
          style={{ width: `${Math.round(progress.progress * 100)}%` }}
        />
      </div>
    </Card>
  );
}

function ChallengeCard({ doneToday }: { doneToday: boolean }) {
  return (
    <Card>
      <Label>Today&apos;s challenge</Label>
      <p className="mt-2.5 text-[1.05rem] font-medium text-ink">
        {doneToday ? "Complete" : "Not complete"}
      </p>
      <div className="mt-3">
        {doneToday ? (
          <Link
            href="/practice"
            className="text-[0.82rem] text-ink-muted transition-colors hover:text-ink"
          >
            Practice again →
          </Link>
        ) : (
          <Button href="/practice">
            Start <ArrowGlyph />
          </Button>
        )}
      </div>
    </Card>
  );
}

export function QuestList({ quests }: { quests: DailyQuestState }) {
  if (quests.total === 0) return null;

  return (
    <Card className="h-full">
      <div className="flex items-baseline justify-between gap-4">
        <Label>Today&apos;s quests</Label>
        <p className="font-mono text-[0.8rem] tabular-nums text-ink-muted">
          {quests.completedCount} / {quests.total} complete
        </p>
      </div>

      <ul className="mt-4 flex flex-col gap-2.5">
        {quests.quests.map((quest) => {
          const done = quests.completed.includes(quest.id);
          return (
            <li
              key={quest.id}
              className={cn(
                "flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors",
                done
                  ? "border-ember/30 bg-ember/[0.06]"
                  : "border-hairline bg-paper",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "mt-[3px] flex size-4 shrink-0 items-center justify-center rounded-full border text-[0.6rem]",
                  done
                    ? "border-ember bg-ember text-white"
                    : "border-ink-muted/40 text-transparent",
                )}
              >
                ✓
              </span>
              <span className="min-w-0">
                <span className="flex flex-wrap items-baseline gap-2">
                  <span className="text-[0.92rem] font-medium text-ink">
                    {quest.title}
                  </span>
                  <span className="text-[0.68rem] uppercase tracking-[0.12em] text-ink-muted">
                    {quest.difficulty}
                  </span>
                </span>
                <span className="mt-0.5 block text-[0.82rem] leading-[1.5] text-ink-soft">
                  {quest.description}
                </span>
              </span>
              <span className="ml-auto shrink-0 font-mono text-[0.75rem] tabular-nums text-ink-muted">
                +{quest.xpReward}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="sr-only">
        {quests.completedCount} of {quests.total} quests complete today.
      </p>
    </Card>
  );
}

/**
 * The dashboard header: who you are today, at a glance.
 *
 * Left column is state you already have (streak, level, whether today is done);
 * right column is what is still available to earn. That split is deliberate —
 * the things you cannot change today sit apart from the things you can.
 */
export function DashboardSummary({
  displayName,
  streak,
  longestStreak,
  levelProgress,
  doneToday,
  quests,
}: {
  displayName: string | null;
  streak: number;
  longestStreak: number;
  levelProgress: LevelProgress;
  doneToday: boolean;
  quests: DailyQuestState;
}) {
  const firstName = displayName?.trim().split(/\s+/)[0];

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-[clamp(1.7rem,3vw,2.2rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-ink">
        Welcome back{firstName ? `, ${firstName}` : ""}.
      </h1>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="grid gap-4 sm:grid-cols-3">
          <StreakCard streak={streak} longestStreak={longestStreak} />
          <LevelCard progress={levelProgress} />
          <ChallengeCard doneToday={doneToday} />
        </div>

        <QuestList quests={quests} />
      </div>
    </div>
  );
}
