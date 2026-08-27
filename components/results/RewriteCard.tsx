"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * A model-written version of the same answer.
 *
 * Set as editorial prose — generous measure, large body type, no monospace and
 * no tinted panel. It is something to read aloud, and anything that made it look
 * like a code sample would work against that.
 */
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
    <section className="rounded-3xl border border-hairline bg-canvas px-6 py-8 sm:px-10 sm:py-10">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-ink-muted">
          Try this instead
        </h2>
        <button
          type="button"
          onClick={copy}
          className="rounded px-2 py-1 text-[0.82rem] text-ink-muted transition-colors duration-200 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember/40 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <p className="mt-6 max-w-[46rem] text-[clamp(1.15rem,1.9vw,1.4rem)] leading-[1.65] tracking-[-0.015em] text-ink">
        {rewrite}
      </p>

      <p aria-live="polite" className="sr-only">
        {copied ? "Copied to clipboard" : ""}
      </p>
    </section>
  );
}
