import { PoiseLogo } from "@/components/brand/PoiseLogo";
import { BrowserFrame } from "@/components/marketing/BrowserFrame";
import { Hero } from "@/components/marketing/Hero";

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-6 sm:px-6 lg:gap-10 lg:px-0 lg:py-[3vh]">
      <PoiseLogo className="text-[2rem] lg:text-[2.5rem]" />
      <BrowserFrame className="lg:h-[76vh] lg:min-h-[38rem] lg:w-[92vw]">
        <div className="h-full overflow-hidden rounded-lg lg:overflow-visible">
          <Hero />
        </div>
      </BrowserFrame>
    </main>
  );
}
