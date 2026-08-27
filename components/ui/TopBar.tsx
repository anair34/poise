import { Wordmark } from "@/components/marketing/Wordmark";
import { AccountMenu } from "@/components/auth/AccountMenu";
import { getCurrentUser } from "@/lib/auth/server";

/**
 * Minimal product chrome shared by the in-app routes.
 *
 * The wordmark points at the dashboard once you're signed in, since the
 * marketing page has nothing left to offer you at that point.
 */
export async function TopBar({ streak }: { streak?: number }) {
  const user = await getCurrentUser().catch(() => null);

  return (
    <header className="flex items-center justify-between gap-4 border-b border-hairline pb-4">
      <Wordmark
        href={user ? "/conversations" : "/"}
        label={user ? "Your conversations" : "Poise home"}
      />
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
