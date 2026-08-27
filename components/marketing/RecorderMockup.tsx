import { RecorderCard } from "@/components/practice/RecorderCard";
import { getLibraryPrompt } from "@/lib/prompts";
import { MAX_DURATION_MS } from "@/lib/recording";
import { formatClock } from "@/lib/format";

/**
 * Non-interactive preview of the real /practice recorder. Shares the same card
 * so the landing page and the product can never drift apart.
 *
 * The numbers here are illustrative, not real. This renders for signed-out
 * visitors on the landing page, so it deliberately reads nothing from Firestore
 * — including today's actual prompt, which would make an unauthenticated page
 * depend on the database being reachable.
 */
const SHOWCASE_STREAK = 7;

export function RecorderMockup({ className }: { className?: string }) {
  const prompt = getLibraryPrompt(0);

  return (
    <div
      role="img"
      aria-label="Preview of the Poise recording interface showing a daily challenge, a sixty second timer, and a seven day streak."
      className={className}
    >
      <RecorderCard
        category={prompt.category}
        streak={SHOWCASE_STREAK}
        prompt={prompt.text}
        state="ready"
        timerLabel={formatClock(MAX_DURATION_MS)}
        hint="Tap to start. Speak for sixty seconds."
        interactive={false}
        showRing
      />
    </div>
  );
}
