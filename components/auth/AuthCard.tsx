import Link from "next/link";
import type { ReactNode } from "react";
import { PoiseLogo } from "@/components/brand/PoiseLogo";

/**
 * Centered card shared by sign in, get started, and password reset.
 *
 * Pure presentation and hook-free, so each auth route can stay a server
 * component and only its form is client-side.
 */
export function AuthCard({
  title,
  switchPrompt,
  switchLabel,
  switchHref,
  children,
  footnote,
}: {
  title: string;
  switchPrompt?: string;
  switchLabel?: string;
  switchHref?: string;
  children: ReactNode;
  footnote?: ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <div className="w-full max-w-[25rem]">
        <div className="rounded-2xl border border-hairline bg-canvas px-6 py-9 shadow-[0_30px_60px_-45px_rgba(17,17,17,0.35)] sm:px-9">
          <div className="flex flex-col items-center text-center">
            <Link
              href="/"
              aria-label="Poise home"
              className="inline-flex items-center rounded text-[1.3rem] transition-opacity duration-200 hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember/40 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
            >
              <PoiseLogo />
            </Link>

            <h1 className="mt-6 text-[1.75rem] font-semibold leading-none tracking-[-0.03em] text-ink">
              {title}
            </h1>

            {switchPrompt && switchLabel && switchHref ? (
              <p className="mt-3 text-[0.9rem] text-ink-soft">
                {switchPrompt}{" "}
                <Link
                  href={switchHref}
                  className="group font-medium text-ember transition-colors duration-200 hover:text-ember-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember/40"
                >
                  {switchLabel}{" "}
                  <span
                    aria-hidden
                    className="inline-block transition-transform duration-200 group-hover:translate-x-0.5"
                  >
                    →
                  </span>
                </Link>
              </p>
            ) : null}
          </div>

          <div className="mt-8">{children}</div>
        </div>

        {footnote ? (
          <p className="mx-auto mt-6 max-w-[34ch] text-center text-[0.78rem] leading-[1.6] text-ink-muted">
            {footnote}
          </p>
        ) : null}
      </div>
    </main>
  );
}

/** The "or" rule between the Google button and the email form. */
export function AuthDivider() {
  return (
    <div className="my-6 flex items-center gap-4" aria-hidden>
      <span className="h-px flex-1 bg-hairline" />
      <span className="text-[0.78rem] text-ink-muted">or</span>
      <span className="h-px flex-1 bg-hairline" />
    </div>
  );
}
