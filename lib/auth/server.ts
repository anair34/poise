import "server-only";

import { cookies } from "next/headers";
import { FirebaseConfigError, getAdminAuth } from "@/lib/firebase/admin";
import { SESSION_COOKIE, SESSION_MAX_AGE_MS } from "./cookie";

/**
 * Server-side identity.
 *
 * The browser signs in with the Firebase client SDK, which yields a short-lived
 * ID token. That token is useless to server components, so it is exchanged once
 * for a session cookie: an httpOnly credential the server can verify on every
 * render without JavaScript being involved.
 *
 * This is what makes `/results` and `/progress` safe to render on the server.
 */

export { SESSION_COOKIE, SESSION_MAX_AGE_MS };

export interface AuthUser {
  uid: string;
  email: string | null;
  name: string | null;
  picture: string | null;
}

/**
 * The signed-in user, or null.
 *
 * Verification is local (signature and expiry) and does not check for
 * revocation, because this runs on every protected render and a network round
 * trip per page would be felt. Sign-out clears the cookie, so the exposure is
 * limited to a stolen cookie remaining usable until it expires. Routes that act
 * destructively should call `requireFreshUser` instead.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const store = await cookies();
  const cookie = store.get(SESSION_COOKIE)?.value;
  if (!cookie) return null;

  try {
    const claims = await getAdminAuth().verifySessionCookie(cookie, false);
    return {
      uid: claims.uid,
      email: claims.email ?? null,
      name: (claims.name as string | undefined) ?? null,
      picture: (claims.picture as string | undefined) ?? null,
    };
  } catch (caught) {
    // An expired or tampered cookie is an ordinary signed-out state, not an
    // error worth surfacing. A misconfiguration is worth shouting about.
    if (caught instanceof FirebaseConfigError) throw caught;
    return null;
  }
}

/** Like `getCurrentUser`, but rejects a cookie whose tokens were revoked. */
export async function getFreshUser(): Promise<AuthUser | null> {
  const store = await cookies();
  const cookie = store.get(SESSION_COOKIE)?.value;
  if (!cookie) return null;

  try {
    const claims = await getAdminAuth().verifySessionCookie(cookie, true);
    return {
      uid: claims.uid,
      email: claims.email ?? null,
      name: (claims.name as string | undefined) ?? null,
      picture: (claims.picture as string | undefined) ?? null,
    };
  } catch (caught) {
    if (caught instanceof FirebaseConfigError) throw caught;
    return null;
  }
}
