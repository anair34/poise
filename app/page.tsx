import { PoiseLogo } from "@/components/brand/PoiseLogo";
import { BrowserFrame } from "@/components/marketing/BrowserFrame";
import { Hero } from "@/components/marketing/Hero";

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 px-4 py-5 sm:px-6 lg:gap-6 lg:px-0 lg:py-[2vh]">
      <PoiseLogo className="text-[3.25rem] leading-none lg:text-[4.5rem]" />
      <BrowserFrame className="lg:h-[76vh] lg:min-h-[38rem] lg:w-[92vw]">
        <div className="h-full overflow-hidden rounded-lg lg:overflow-visible">
          <Hero />
        </div>
      </BrowserFrame>
    </main>
  );
}
