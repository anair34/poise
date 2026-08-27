import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_MS,
} from "@/lib/auth/server";
import { FirebaseConfigError, getAdminAuth } from "@/lib/firebase/admin";
import { ensureUser } from "@/lib/users";

export const runtime = "nodejs";

/**
 * The ID-token-for-cookie exchange.
 *
 * POST establishes a server-visible session; DELETE ends it. Nothing else in
 * the app sets this cookie.
 */

/** Recency window for the ID token being exchanged. */
const MAX_TOKEN_AGE_MS = 5 * 60 * 1000;

function isSecureRequest(request: Request): boolean {
  if (process.env.NODE_ENV === "production") return true;
  return new URL(request.url).protocol === "https:";
}

export async function POST(request: Request) {
  let idToken: string;
  try {
    const body = (await request.json()) as { idToken?: unknown };
    if (typeof body.idToken !== "string" || !body.idToken) {
      return NextResponse.json({ error: "Missing ID token." }, { status: 400 });
    }
    idToken = body.idToken;
  } catch {
    return NextResponse.json({ error: "Expected JSON." }, { status: 400 });
  }

  try {
    // Verify before minting. `createSessionCookie` alone would also reject a
    // forged token, but verifying first lets us enforce token freshness, which
    // limits the value of a token intercepted earlier.
    const claims = await getAdminAuth().verifyIdToken(idToken, true);
    const issuedAtMs = claims.auth_time * 1000;
    if (Date.now() - issuedAtMs > MAX_TOKEN_AGE_MS) {
      return NextResponse.json(
        { error: "Please sign in again." },
        { status: 401 },
      );
    }

    const cookie = await getAdminAuth().createSessionCookie(idToken, {
      expiresIn: SESSION_MAX_AGE_MS,
    });

    const store = await cookies();
    store.set(SESSION_COOKIE, cookie, {
      httpOnly: true,
      secure: isSecureRequest(request),
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_MS / 1000,
    });

    // Create the user document now, so a first-time user has streak state before
    // they ever finish a recording. A failure here must not block sign-in: the
    // document is also created on demand when a session is recorded.
    try {
      await ensureUser({
        uid: claims.uid,
        email: claims.email ?? null,
        displayName: (claims.name as string | undefined) ?? null,
        photoURL: (claims.picture as string | undefined) ?? null,
      });
    } catch (caught) {
      console.error(
        "[auth] could not upsert user profile:",
        caught instanceof Error ? caught.message : caught,
      );
    }

    return NextResponse.json({ uid: claims.uid });
  } catch (caught) {
    if (caught instanceof FirebaseConfigError) {
      console.error("[auth] firebase not configured");
      return NextResponse.json(
        { error: "Sign-in isn't configured yet." },
        { status: 503 },
      );
    }
    console.error(
      "[auth] failed to create session:",
      caught instanceof Error ? caught.message : caught,
    );
    return NextResponse.json({ error: "Could not sign you in." }, { status: 401 });
  }
}

export async function DELETE() {
  const store = await cookies();
  const cookie = store.get(SESSION_COOKIE)?.value;
  store.delete(SESSION_COOKIE);

  // Revoke refresh tokens so the session cannot be resurrected from a copy of
  // the cookie taken before sign-out. Best-effort: the cookie is already gone.
  if (cookie) {
    try {
      const claims = await getAdminAuth().verifySessionCookie(cookie, false);
      await getAdminAuth().revokeRefreshTokens(claims.sub);
    } catch {
      // Already invalid, which is the desired end state anyway.
    }
  }

  return NextResponse.json({ ok: true });
}
