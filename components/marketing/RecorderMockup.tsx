import { RecorderCard } from "@/components/practice/RecorderCard";
import { getDailyPrompt } from "@/lib/prompts";
import { DEMO_DAY_NUMBER, DEMO_STREAK } from "@/lib/demo";
import { MAX_DURATION_MS } from "@/lib/recording";
import { formatClock } from "@/lib/format";

/**
 * Non-interactive preview of the real /practice recorder. Shares the same card
 * so the landing page and the product can never drift apart.
 */
export function RecorderMockup({ className }: { className?: string }) {
  const prompt = getDailyPrompt();

  return (
    <div
      role="img"
      aria-label="Preview of the Poise recording interface showing today's challenge, a sixty second timer, and a seven day streak."
      className={className}
    >
      <RecorderCard
        dayNumber={DEMO_DAY_NUMBER}
        category={prompt.category}
        streak={DEMO_STREAK}
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
