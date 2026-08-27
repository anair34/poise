"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { formatDuration, safeScore } from "@/lib/results";
import type { Session } from "@/lib/types";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * A month is addressed by year and zero-based month index, in UTC.
 *
 * UTC throughout, because a day key here has to mean the same thing it means to
 * the streak and the daily prompt. Using local dates would put a late-evening
 * session in the wrong square for anyone west of Greenwich.
 */
interface MonthCursor {
  year: number;
  month: number;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function dayKey(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
}

function monthCursorFor(key: string): MonthCursor {
  const date = new Date(`${key}T00:00:00.000Z`);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() };
}

function shiftMonth(cursor: MonthCursor, delta: number): MonthCursor {
  const date = new Date(Date.UTC(cursor.year, cursor.month + delta, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() };
}

function isSameMonth(a: MonthCursor, b: MonthCursor): boolean {
  return a.year === b.year && a.month === b.month;
}

function formatLongDay(key: string): string {
  return new Date(`${key}T00:00:00.000Z`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Ember fill that deepens with the score, so the grid reads as a heat map. */
function dayTint(score: number): string {
  if (score >= 80) return "bg-ember text-white border-ember";
  if (score >= 60) return "bg-ember/55 text-ink border-ember/55";
  if (score >= 40) return "bg-ember/30 text-ink border-ember/30";
  return "bg-ember/15 text-ink border-ember/20";
}

function DayDetail({
  selected,
  sessions,
  isToday,
}: {
  selected: string;
  sessions: Session[];
  isToday: boolean;
}) {
  if (sessions.length === 0) {
    return (
      <div className="h-full rounded-2xl border border-hairline bg-canvas p-6">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-ink-muted">
          {formatLongDay(selected)}
        </p>
        <p className="mt-3 text-[0.95rem] leading-[1.6] text-ink-soft">
          {isToday
            ? "You haven't practiced yet today."
            : "No practice on this day."}
        </p>
        {isToday ? (
          <Link
            href="/practice"
            className="mt-4 inline-flex text-[0.85rem] font-medium text-ember hover:text-ember-deep"
          >
            Start today&apos;s challenge →
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className="h-full rounded-2xl border border-hairline bg-canvas p-6">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-ink-muted">
          {formatLongDay(selected)}
        </p>
        <p className="text-[0.72rem] text-ink-muted">
          {sessions.length === 1 ? "1 session" : `${sessions.length} sessions`}
        </p>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {sessions.map((session) => (
          <Link
            key={session.id}
            href={`/results/${session.id}`}
            className="group rounded-xl border border-hairline p-4 transition-colors duration-200 hover:border-ink-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember/40"
          >
            <div className="flex items-start gap-4">
              <span className="font-mono text-[1.35rem] tabular-nums leading-none text-ink">
                {safeScore(session.overallScore)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-ember">
                  {session.category}
                </p>
                <p className="mt-1.5 text-[0.92rem] font-medium leading-[1.45] text-ink">
                  {session.promptText}
                </p>
                {session.feedback?.summary ? (
                  <p className="mt-2 line-clamp-2 text-[0.84rem] leading-[1.6] text-ink-soft">
                    {session.feedback.summary}
                  </p>
                ) : null}
                <div className="mt-3 flex items-center gap-4 text-[0.72rem] tabular-nums text-ink-muted">
                  {typeof session.metrics?.durationSeconds === "number" ? (
                    <span>{formatDuration(session.metrics.durationSeconds)}</span>
                  ) : null}
                  {typeof session.metrics?.wordsPerMinute === "number" ? (
                    <span>{Math.round(session.metrics.wordsPerMinute)} wpm</span>
                  ) : null}
                  <span className="ml-auto transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-ink">
                    Open →
                  </span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function PracticeCalendar({
  sessions,
  streak = 0,
  longestStreak = 0,
  perfectDays = [],
}: {
  sessions: Session[];
  streak?: number;
  longestStreak?: number;
  /** Day keys where every assigned quest was completed. */
  perfectDays?: string[];
}) {
  const today = todayKey();
  const currentMonth = monthCursorFor(today);
  const perfect = useMemo(() => new Set(perfectDays), [perfectDays]);

  const [cursor, setCursor] = useState<MonthCursor>(currentMonth);
  const [selected, setSelected] = useState<string>(today);

  const byDay = useMemo(() => {
    const map = new Map<string, Session[]>();
    for (const session of sessions) {
      const key = session.challengeDate;
      const existing = map.get(key);
      if (existing) existing.push(session);
      else map.set(key, [session]);
    }
    return map;
  }, [sessions]);

  const { leading, days } = useMemo(() => {
    const firstOfMonth = new Date(Date.UTC(cursor.year, cursor.month, 1));
    const dayCount = new Date(
      Date.UTC(cursor.year, cursor.month + 1, 0),
    ).getUTCDate();
    return {
      leading: firstOfMonth.getUTCDay(),
      days: Array.from({ length: dayCount }, (_, index) => index + 1),
    };
  }, [cursor]);

  const selectedSessions = byDay.get(selected) ?? [];
  const atCurrentMonth = isSameMonth(cursor, currentMonth);

  const practiceDaysThisMonth = useMemo(() => {
    const prefix = `${cursor.year}-${String(cursor.month + 1).padStart(2, "0")}`;
    let count = 0;
    for (const key of byDay.keys()) {
      if (key.startsWith(prefix)) count += 1;
    }
    return count;
  }, [byDay, cursor]);

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-stretch lg:gap-6">
      <section className="rounded-2xl border border-hairline bg-canvas p-5 sm:p-6 lg:flex-[2.2]">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-[1.05rem] font-semibold tracking-[-0.01em] text-ink">
            {MONTHS[cursor.month]} {cursor.year}
          </h2>

          <div className="flex items-center gap-1">
            {!atCurrentMonth ? (
              <button
                type="button"
                onClick={() => setCursor(currentMonth)}
                className="mr-1 rounded-full border border-hairline px-3 py-1 text-[0.75rem] font-medium text-ink-soft transition-colors hover:border-ink-muted/50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember/40"
              >
                Today
              </button>
            ) : null}
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setCursor(shiftMonth(cursor, -1))}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-hairline text-ink-soft transition-colors hover:border-ink-muted/50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember/40"
            >
              ←
            </button>
            <button
              type="button"
              aria-label="Next month"
              disabled={atCurrentMonth}
              onClick={() => setCursor(shiftMonth(cursor, 1))}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-hairline text-ink-soft transition-colors hover:border-ink-muted/50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember/40 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-hairline"
            >
              →
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map((label, index) => (
            <div
              key={`${label}-${index}`}
              aria-hidden
              className="pb-1 text-center text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-ink-muted"
            >
              {label}
            </div>
          ))}

          {Array.from({ length: leading }, (_, index) => (
            <div key={`pad-${index}`} />
          ))}

          {days.map((day) => {
            const key = dayKey(cursor.year, cursor.month, day);
            const daySessions = byDay.get(key) ?? [];
            const best = daySessions.length
              ? Math.max(...daySessions.map((s) => safeScore(s.overallScore)))
              : null;
            const isToday = key === today;
            const isSelected = key === selected;
            const isFuture = key > today;
            // Every quest done that day. Marked with a small dot rather than a
            // badge or burst: it should reward a second look, not demand one.
            const isPerfect = perfect.has(key) && daySessions.length > 0;

            return (
              <button
                key={key}
                type="button"
                disabled={isFuture}
                onClick={() => setSelected(key)}
                aria-pressed={isSelected}
                aria-label={`${formatLongDay(key)}${
                  daySessions.length
                    ? `, ${daySessions.length} session${daySessions.length === 1 ? "" : "s"}, best score ${best}`
                    : ", no practice"
                }${isPerfect ? ", all quests complete" : ""}`}
                className={cn(
                  // A fixed height rather than a square, so widening the page
                  // fills the row instead of inflating every cell.
                  "relative flex h-[clamp(2.75rem,4vw,4.25rem)] flex-col items-center justify-center rounded-lg border text-[0.85rem] tabular-nums transition-all duration-150",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember/40",
                  best === null
                    ? "border-hairline bg-paper/60 text-ink-muted"
                    : dayTint(best),
                  isFuture && "cursor-not-allowed opacity-30",
                  !isFuture && "hover:-translate-y-0.5 hover:border-ink-muted/50",
                  isSelected && "ring-2 ring-ink ring-offset-2 ring-offset-canvas",
                )}
              >
                <span className={cn(isToday && "font-semibold underline")}>
                  {day}
                </span>
                {isPerfect ? (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute right-1.5 top-1.5 size-1.5 rounded-full",
                      best !== null && best >= 80 ? "bg-white/80" : "bg-ember",
                    )}
                  />
                ) : null}
                {daySessions.length > 1 ? (
                  <span className="absolute bottom-1 text-[0.58rem] opacity-70">
                    ×{daySessions.length}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
          <p className="flex items-center gap-2 text-[0.7rem] text-ink-muted">
            <span>Lower</span>
            <span className="h-2.5 w-5 rounded-sm bg-ember/15" />
            <span className="h-2.5 w-5 rounded-sm bg-ember/30" />
            <span className="h-2.5 w-5 rounded-sm bg-ember/55" />
            <span className="h-2.5 w-5 rounded-sm bg-ember" />
            <span>Higher score</span>
          </p>

          <p className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[0.72rem] tabular-nums text-ink-muted">
            <span>
              <span className="text-ink">{streak}</span> day streak
            </span>
            <span>
              Longest <span className="text-ink">{longestStreak}</span>
            </span>
            <span>
              <span className="text-ink">{practiceDaysThisMonth}</span> days this
              month
            </span>
          </p>
        </div>
      </section>

      <div className="lg:flex-1">
        <DayDetail
          selected={selected}
          sessions={selectedSessions}
          isToday={selected === today}
        />
      </div>
    </div>
  );
}
