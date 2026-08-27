import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/cookie";

/**
 * Redirects signed-out visitors away from the private routes.
 *
 * This is a convenience, not the security boundary. Proxy runs on the edge
 * runtime, where firebase-admin cannot run, so all this can do is notice whether
 * a session cookie exists — it cannot tell a valid cookie from a forged one.
 * Actual verification happens in `getCurrentUser`, and every protected page and
 * route calls it. The value here is that someone who is simply signed out lands
 * on a sign-in screen instead of a "not found".
 *
 * (Named `proxy`, not `middleware`: the middleware convention is deprecated in
 * this version of Next.)
 */

const PROTECTED = ["/results", "/conversations"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (!PROTECTED.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  if (request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.next();
  }

  const signInUrl = new URL("/signin", request.url);
  signInUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(signInUrl);
}

export const config = {
  matcher: ["/results/:path*", "/conversations/:path*"],
};
