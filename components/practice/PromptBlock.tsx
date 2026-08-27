export function PromptBlock({ prompt }: { prompt: string }) {
  return (
    <div>
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-ink-muted">
        Today&apos;s challenge
      </p>
      <p className="mt-4 max-w-[24ch] text-[1.35rem] font-medium leading-[1.3] tracking-[-0.015em] text-ink sm:text-[1.6rem]">
        {prompt}
      </p>
    </div>
  );
}
