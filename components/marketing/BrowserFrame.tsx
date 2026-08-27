import { cn } from "@/lib/cn";

/**
 * Editorial browser-chrome shell used as the page canvas.
 * Chrome is decorative; children render inside the white content area.
 */
export function BrowserFrame({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex w-full flex-col rounded-xl bg-[#1c1c1a] p-1.5 shadow-[0_28px_70px_-40px_rgba(17,17,17,0.45)] sm:p-2",
        className,
      )}
    >
      <div className="flex items-center gap-3 px-2.5 pb-2.5 pt-1.5">
        <div className="flex shrink-0 items-center gap-[6px]">
          <span className="size-[9px] rounded-full bg-[#ff5f57]" />
          <span className="size-[9px] rounded-full bg-[#febc2e]" />
          <span className="size-[9px] rounded-full bg-[#28c840]" />
        </div>
        <div className="mx-auto hidden h-6 w-[42%] items-center justify-center rounded-md bg-white/[0.07] sm:flex">
          <span className="font-mono text-[0.65rem] tracking-wide text-white/35">
            poise.app
          </span>
        </div>
        <div className="hidden w-[52px] shrink-0 sm:block" />
      </div>

      <div className="relative min-h-0 flex-1 rounded-lg bg-canvas">
        {children}
      </div>
    </div>
  );
}
