import { BrowserFrame } from "@/components/marketing/BrowserFrame";
import { Hero } from "@/components/marketing/Hero";

export default function LandingPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-6 sm:px-6 lg:px-0 lg:py-[4vh]">
      <BrowserFrame className="lg:h-[88vh] lg:min-h-[44rem] lg:w-[92vw]">
        <div className="h-full overflow-hidden rounded-lg lg:overflow-visible">
          <Hero />
        </div>
      </BrowserFrame>
    </main>
  );
}
