import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "ghost";

const base =
  "group inline-flex items-center justify-center gap-2.5 rounded-md text-[0.95rem] font-medium " +
  "transition-[background-color,color,transform,border-color] duration-200 ease-out " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember/40 focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-canvas active:translate-y-px";

const variants: Record<Variant, string> = {
  primary:
    "bg-ember px-7 py-3.5 text-white hover:bg-ember-deep hover:shadow-[0_8px_20px_-12px_rgba(217,85,26,0.7)]",
  ghost:
    "border border-hairline bg-canvas px-6 py-3.5 text-ink hover:border-ink/25 hover:bg-paper",
};

type ButtonProps = {
  variant?: Variant;
  children: ReactNode;
} & Omit<ComponentProps<typeof Link>, "children">;

export function Button({
  variant = "primary",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <Link className={cn(base, variants[variant], className)} {...props}>
      {children}
    </Link>
  );
}

export function ArrowGlyph() {
  return (
    <span
      aria-hidden
      className="translate-x-0 transition-transform duration-200 ease-out group-hover:translate-x-1"
    >
      →
    </span>
  );
}
