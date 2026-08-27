import { Wordmark } from "@/components/marketing/Wordmark";
import { AccountMenu } from "@/components/auth/AccountMenu";

/** Minimal product chrome shared by the in-app routes. */
export function TopBar({ streak }: { streak?: number }) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-hairline pb-4">
      <Wordmark />
      <nav className="flex items-center gap-5 text-[0.82rem]">
        {typeof streak === "number" && streak > 0 ? (
          <span
            className="flex items-center gap-1.5 rounded-full border border-hairline bg-paper px-2.5 py-1 text-[0.75rem] font-medium text-ink-soft"
            title={`${streak} day streak`}
          >
            <span aria-hidden>🔥</span>
            {streak}
            <span className="sr-only">day streak</span>
          </span>
        ) : null}
        <AccountMenu />
      </nav>
    </header>
  );
}
