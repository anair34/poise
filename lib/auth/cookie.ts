/**
 * Session cookie constants.
 *
 * Deliberately free of `server-only` and of any Node dependency: `proxy.ts` runs
 * on the edge runtime and needs the cookie name, but must not pull in
 * firebase-admin.
 */

export const SESSION_COOKIE = "poise_session";

/** Two weeks, the maximum Firebase allows for a session cookie. */
export const SESSION_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
