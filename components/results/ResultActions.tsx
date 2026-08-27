import Link from "next/link";
import { getNextPrompt } from "@/lib/prompts";

/**
 * Where to go next.
 *
 * Reduced to plain navigation, because the retry CTA now lives in its own block
 * further up. Two primary buttons on one page means neither is primary, and the
 * one that matters is "beat your score".
 */
export function ResultActions({
  promptId,
  encouragement,
}: {
  promptId: string;
  encouragement?: string;
}) {
  const nextPrompt = getNextPrompt(promptId);

  const linkClass =
    "rounded px-1 py-1 text-[0.9rem] text-ink-muted transition-colors duration-200 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember/40 focus-visible:ring-offset-2 focus-visible:ring-offset-paper";

  return (
    <section className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 border-t border-hairline pt-6">
      {encouragement ? (
        <p className="max-w-xl text-[0.92rem] leading-[1.6] text-ink-soft">
          {encouragement}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-6">
        <Link href="/conversations" className={linkClass}>
          Your conversations
        </Link>
        <Link href={`/practice?prompt=${nextPrompt.id}`} className={linkClass}>
          New prompt
        </Link>
      </div>
    </section>
  );
}
