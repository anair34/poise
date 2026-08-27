import { getQuest } from "@/lib/gamification/quests";
import { getLevelProgress } from "@/lib/gamification/levels";
import type { SessionGamification } from "@/lib/types";

/**
 * What this session earned.
 *
 * Every value here was computed on the server and frozen onto the session, so
 * this component only formats — it never decides whether something was earned.
 *
 * Motion is a single settle on arrival behind `motion-safe:`, and nothing loops.
 * A reward moment should land once; anything that keeps moving stops being a
 * reward and starts being a distraction from the coaching below it.
 */

function Stat({
  value,
  label,
  accent,
}: {
  value: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span
        className={
          accent
            ? "font-mono text-[1.35rem] leading-none tabular-nums text-ember"
            : "font-mono text-[1.35rem] leading-none tabular-nums text-ink"
        }
      >
        {value}
      </span>
      <span className="text-[0.82rem] text-ink-muted">{label}</span>
    </div>
  );
}

function QuestComplete({
  title,
  description,
  xp,
}: {
  title: string;
  description: string;
  xp: number;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-ember/25 bg-ember/[0.05] px-4 py-3.5">
      <div className="min-w-0">
        <p className="text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-ember">
          Quest complete
        </p>
        <p className="mt-1.5 text-[0.98rem] font-medium text-ink">{title}</p>
        <p className="mt-0.5 text-[0.86rem] leading-[1.5] text-ink-soft">
          {description}
        </p>
      </div>
      <p className="shrink-0 font-mono text-[0.85rem] tabular-nums text-ember">
        +{xp}
      </p>
    </div>
  );
}

export function SessionRewards({
  gamification,
  streak,
}: {
  gamification: SessionGamification;
  streak: number;
}) {
  const quests = gamification.questsCompleted
    .map((id) => getQuest(id))
    .filter((quest) => Boolean(quest));

  const progress = getLevelProgress(gamification.totalXp);

  // With nothing earned there is nothing to celebrate, and an empty strip
  // saying so would be worse than no strip at all.
  const hasReward =
    gamification.xpEarned > 0 || quests.length > 0 || streak > 0;
  if (!hasReward) return null;

  return (
    <section
      aria-label="What this session earned"
      className="motion-safe:animate-rise rounded-2xl border border-hairline bg-canvas px-6 py-5 sm:px-8"
    >
      <div className="flex flex-wrap items-center gap-x-9 gap-y-4">
        {streak > 0 ? (
          <div className="flex items-baseline gap-2">
            <span aria-hidden className="text-[1.05rem]">
              🔥
            </span>
            <Stat value={String(streak)} label="day streak" />
          </div>
        ) : null}

        {gamification.xpEarned > 0 ? (
          <Stat value={`+${gamification.xpEarned}`} label="XP" accent />
        ) : null}

        <Stat value={String(progress.level)} label="Level" />

        {quests.length > 0 ? (
          <p className="text-[0.85rem] text-ink-muted">
            {quests.length} {quests.length === 1 ? "quest" : "quests"} complete
          </p>
        ) : null}

        {gamification.didLevelUp ? (
          <p className="rounded-full border border-ember/30 bg-ember/[0.07] px-3.5 py-1.5 text-[0.78rem] font-medium text-ember">
            Level up — level {gamification.level}
          </p>
        ) : null}

        {/* Progress toward the next level, kept quiet and right-aligned. */}
        <div className="ml-auto min-w-[10rem] grow sm:grow-0">
          <div className="flex items-baseline justify-between gap-3 text-[0.74rem] text-ink-muted">
            <span>Level {progress.level}</span>
            <span className="font-mono tabular-nums">
              {progress.xpIntoLevel} / {progress.xpForLevel} XP
            </span>
          </div>
          <div
            className="mt-1.5 h-[2px] w-full overflow-hidden rounded-full bg-hairline"
            role="img"
            aria-label={`${progress.xpIntoLevel} of ${progress.xpForLevel} XP toward level ${progress.level + 1}`}
          >
            <div
              className="h-full rounded-full bg-ember"
              style={{ width: `${Math.round(progress.progress * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {quests.length > 0 ? (
        <div className="mt-5 flex flex-col gap-2.5">
          {quests.map((quest) =>
            quest ? (
              <QuestComplete
                key={quest.id}
                title={quest.title}
                description={quest.description}
                xp={quest.xpReward}
              />
            ) : null,
          )}
        </div>
      ) : null}
    </section>
  );
}
