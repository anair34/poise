"use client";

import { useCallback, useEffect, useState } from "react";
import { Eyebrow } from "@/components/ui/Eyebrow";

export function RewriteCard({ rewrite }: { rewrite: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(rewrite);
      setCopied(true);
    } catch {
      // Clipboard can be blocked; the text stays selectable either way.
    }
  }, [rewrite]);

  return (
    <section className="rounded-2xl border border-hairline bg-canvas px-6 py-6 sm:px-8 sm:py-7">
      <div className="flex items-center justify-between gap-4">
        <Eyebrow className="text-ink-muted">Try this instead</Eyebrow>
        <button
          type="button"
          onClick={copy}
          className="rounded text-[0.78rem] text-ink-muted transition-colors duration-200 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember/40"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="mt-5 max-w-4xl text-[1.15rem] leading-[1.7] tracking-[-0.01em] text-ink">
        {rewrite}
      </p>
      <p aria-live="polite" className="sr-only">
        {copied ? "Copied to clipboard" : ""}
      </p>
    </section>
  );
}
