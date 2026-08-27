import Link from "next/link";
import { ArrowGlyph, Button } from "@/components/ui/Button";
import { getNextPrompt } from "@/lib/prompts";

export function ResultActions({
  promptId,
  encouragement,
}: {
  promptId: string;
  encouragement?: string;
}) {
  const nextPrompt = getNextPrompt(promptId);

  return (
    <section className="border-t border-hairline pt-8">
      {encouragement ? (
        <p className="mb-7 max-w-xl text-[0.95rem] leading-[1.65] text-ink-soft">
          {encouragement}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button href={`/practice?prompt=${promptId}`}>
          Try again <ArrowGlyph />
        </Button>
        <Button href="/progress" variant="ghost">
          View progress
        </Button>
        <Link
          href={`/practice?prompt=${nextPrompt.id}`}
          className="rounded px-2 py-3.5 text-[0.85rem] text-ink-muted transition-colors duration-200 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember/40"
        >
          New prompt
        </Link>
      </div>
    </section>
  );
}
