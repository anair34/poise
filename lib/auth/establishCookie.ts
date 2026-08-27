import type { User } from "firebase/auth";

/**
 * Trades a Firebase ID token for the httpOnly session cookie the server reads.
 *
 * Lives outside `AuthProvider` because the landing page needs it too, and the
 * landing page has no provider above it — reading the session in the root
 * layout would opt the whole marketing page into dynamic rendering.
 */
export async function establishSessionCookie(user: User): Promise<void> {
  // Forced refresh: the route rejects a token older than five minutes, and a
  // token cached from an earlier visit can easily be past that.
  const idToken = await user.getIdToken(true);

  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    // The route's own copy is already written for a person, so it is passed
    // through rather than replaced with something generic.
    throw new Error(payload?.error ?? "Could not sign you in.");
  }
}
