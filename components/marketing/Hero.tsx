import { HeroCopy } from "./HeroCopy";
import { RecorderMockup } from "./RecorderMockup";

export function Hero() {
  return (
    <div className="grid h-full grid-cols-1 lg:grid-cols-[minmax(0,40%)_minmax(0,60%)]">
      {/* Left: editorial copy column */}
      <div className="relative flex flex-col justify-center px-7 pb-14 pt-9 sm:px-12 lg:py-16 lg:pl-[clamp(3rem,5.5vw,5.5rem)] lg:pr-10">
        <HeroCopy />
      </div>

      {/* Right: product showcase, deliberately overflowing its column */}
      <div className="relative flex items-center overflow-hidden border-t border-hairline bg-paper/70 px-7 pb-16 pt-4 sm:px-12 lg:overflow-visible lg:rounded-r-lg lg:border-l lg:border-t-0 lg:py-16 lg:pl-[clamp(2rem,4vw,4.5rem)] lg:pr-0">
        <RecorderMockup className="mx-auto w-full max-w-[26rem] lg:mx-0 lg:max-w-none lg:-mr-[clamp(1.5rem,4vw,4.5rem)] lg:w-[calc(100%+clamp(1.5rem,4vw,4.5rem))]" />
      </div>
    </div>
  );
}
