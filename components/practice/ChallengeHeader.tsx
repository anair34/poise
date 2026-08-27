export function ChallengeHeader({
  category,
  streak,
}: {
  category: string;
  streak: number;
}) {
  return (
    <div className="flex items-center justify-between border-b border-hairline px-6 py-4 sm:px-7">
      <span className="text-[0.8rem] text-ink-muted">{category}</span>
      <span className="flex items-center gap-1.5 rounded-full border border-hairline bg-paper px-2.5 py-1 text-[0.72rem] font-medium text-ink-soft">
        {streak} day streak
        <span aria-hidden>🔥</span>
      </span>
    </div>
  );
}
