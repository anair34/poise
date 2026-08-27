import { cn } from "@/lib/cn";

export function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-[0.7rem] font-semibold uppercase leading-none tracking-[0.22em] text-ember",
        className,
      )}
    >
      {children}
    </p>
  );
}
