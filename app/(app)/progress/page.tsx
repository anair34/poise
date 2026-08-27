import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowGlyph, Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { TopBar } from "@/components/ui/TopBar";
import { getCurrentUser } from "@/lib/auth/server";
import { safeScore } from "@/lib/results";
import { getRecentSessionsForUser } from "@/lib/sessions";
import { hasPracticedToday, toDayKey, visibleStreak } from "@/lib/streaks";
import { getUserState } from "@/lib/users";
import type { Session } from "@/lib/types";

export const metadata = {
  title: "Your progress — Poise",
};

export const dynamic = "force-dynamic";

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-hairline bg-canvas px-4 py-4">
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-ink-muted">
        {label}
      </p>
      <p className="mt-2 font-mono text-[1.6rem] tabular-nums leading-none text-ink">
        {value}
      </p>
      {hint ? (
        <p className="mt-2 text-[0.75rem] leading-[1.5] text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}

function SessionRow({ session }: { session: Session }) {
  const date = new Date(session.createdAt);
  return (
    <Link
      href={`/results/${session.id}`}
      className="group flex items-center gap-4 border-b border-hairline py-3.5 last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember/40"
    >
      <span className="w-11 shrink-0 font-mono text-[1.05rem] tabular-nums text-ink">
        {safeScore(session.overallScore)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.88rem] text-ink-soft transition-colors duration-200 group-hover:text-ink">
          {session.promptText}
        </span>
        <span className="mt-0.5 block text-[0.74rem] text-ink-muted">
          {date.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
          {" · "}
          {session.category}
        </span>
      </span>
      <span
        aria-hidden
        className="shrink-0 text-ink-muted transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-ink"
      >
        →
      </span>
    </Link>
  );
}

export default async function ProgressPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/signin?next=%2Fprogress");

  const dayKey = toDayKey();
  const [state, sessions] = await Promise.all([
    getUserState(user.uid).catch(() => null),
    getRecentSessionsForUser(user.uid, 30).catch(() => [] as Session[]),
  ]);

  const streak = state ? visibleStreak(state, dayKey) : 0;
  const doneToday = state ? hasPracticedToday(state, dayKey) : false;

  const scored = sessions.map((session) => safeScore(session.overallScore));
  const average = scored.length
    ? Math.round(scored.reduce((sum, value) => sum + value, 0) / scored.length)
    : null;
  const best = scored.length ? Math.max(...scored) : null;

  if (sessions.length === 0) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-5 py-7 sm:px-7 sm:py-9">
        <TopBar streak={streak} />
        <div className="flex flex-1 flex-col justify-center py-16">
          <Eyebrow>Progress</Eyebrow>
          <h1 className="mt-5 text-[clamp(1.9rem,4vw,2.5rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-ink">
            Your first session starts the story.
          </h1>
          <p className="mt-4 max-w-md text-[1.0625rem] leading-[1.6] text-ink-soft">
            Once you&apos;ve recorded a response, your streak, score history, and
            per-dimension trends collect here.
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
    <main className="mx-auto w-full max-w-2xl px-5 py-7 sm:px-7 sm:py-9">
      <TopBar streak={streak} />

      <div className="py-12 sm:py-14">
        <Eyebrow>Progress</Eyebrow>
        <h1 className="mt-5 text-[clamp(1.8rem,4vw,2.3rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-ink">
          {streak > 0
            ? `${streak} day${streak === 1 ? "" : "s"} in a row.`
            : "Ready to start a new streak."}
        </h1>
        <p className="mt-4 max-w-md text-[1.0625rem] leading-[1.6] text-ink-soft">
          {doneToday
            ? "Today's challenge is done. Come back tomorrow to keep the streak alive."
            : "You haven't practiced today yet."}
        </p>

        {!doneToday ? (
          <div className="mt-7">
            <Button href="/practice">
              Today&apos;s challenge <ArrowGlyph />
            </Button>
          </div>
        ) : null}

        <div className="mt-11 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Streak" value={String(streak)} hint="days in a row" />
          <Stat
            label="Longest"
            value={String(state?.longestStreak ?? 0)}
            hint="best run so far"
          />
          <Stat
            label="Sessions"
            value={String(state?.totalSessions ?? sessions.length)}
            hint="recorded in total"
          />
          <Stat
            label="Average"
            value={average === null ? "—" : String(average)}
            hint={best === null ? undefined : `best ${best}`}
          />
        </div>

        <section className="mt-12">
          <h2 className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-ink-muted">
            Recent sessions
          </h2>
          <div className="mt-3">
            {sessions.map((session) => (
              <SessionRow key={session.id} session={session} />
            ))}
          </div>
          {/* The average and best above are drawn from these sessions only, so
              say so rather than implying a lifetime figure. */}
          <p className="mt-5 text-[0.74rem] text-ink-muted">
            Showing your {sessions.length} most recent
            {sessions.length === 1 ? " session" : " sessions"}.
          </p>
        </section>
      </div>
    </main>
  );
}
