import { Recorder } from "@/components/practice/Recorder";
import { Wordmark } from "@/components/marketing/Wordmark";
import { DEMO_DAY_NUMBER, DEMO_STREAK } from "@/lib/demo";
import { getDailyPrompt } from "@/lib/prompts";

export const metadata = {
  title: "Today's challenge — Poise",
};

export default function PracticePage() {
  const prompt = getDailyPrompt();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-5 py-8 sm:px-7 sm:py-10">
      <Wordmark />
      <div className="flex flex-1 items-center py-10">
        <div className="w-full">
          <Recorder
            prompt={prompt}
            dayNumber={DEMO_DAY_NUMBER}
            streak={DEMO_STREAK}
          />
        </div>
      </div>
    </main>
  );
}
