import { AuthProvider } from "@/components/auth/AuthProvider";
import { getCurrentUser } from "@/lib/auth/server";

/**
 * Layout for the signed-in product surface.
 *
 * Resolving the session here rather than in the root layout keeps the marketing
 * page statically rendered — these routes are dynamic regardless, since they all
 * depend on who is asking.
 */
async function loadUser() {
  try {
    return await getCurrentUser();
  } catch (caught) {
    console.error("[app] could not resolve session:", caught);
    return null;
  }
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await loadUser();

  return <AuthProvider initialUser={user}>{children}</AuthProvider>;
}
