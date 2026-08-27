/** Native <details> so the transcript needs no client JavaScript. */
export function TranscriptDisclosure({
  transcript,
  prompt,
}: {
  transcript: string;
  prompt: string;
}) {
  return (
    <details className="group rounded-2xl border border-hairline bg-canvas px-6 py-4 sm:px-8">
      <summary className="flex cursor-pointer list-none items-center gap-2 py-1 text-[0.85rem] text-ink-soft transition-colors duration-200 hover:text-ink [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden
          className="inline-block text-ink-muted transition-transform duration-200 group-open:rotate-90"
        >
          ›
        </span>
        <span className="group-open:hidden">View transcript</span>
        <span className="hidden group-open:inline">Hide transcript</span>
      </summary>

      <div className="mb-3 mt-5 max-w-3xl">
        <p className="text-[0.8rem] italic text-ink-muted">{prompt}</p>
        <p className="mt-4 whitespace-pre-line text-[1rem] leading-[1.8] text-ink-soft">
          {transcript}
        </p>
      </div>
    </details>
  );
}
