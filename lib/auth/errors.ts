/**
 * Turns Firebase auth error codes into sentences a person can act on.
 *
 * Firebase's own messages leak implementation detail ("INVALID_LOGIN_CREDENTIALS")
 * and would be alarming in the UI. Mapping them here also keeps a deliberate
 * ambiguity: a wrong password and an unknown email produce the same message, so
 * the form cannot be used to discover which addresses have accounts.
 */

export const CANCELLED = "cancelled";

const MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "That email and password don't match.",
  "auth/wrong-password": "That email and password don't match.",
  "auth/user-not-found": "That email and password don't match.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/missing-password": "Enter your password.",
  "auth/email-already-in-use":
    "An account already exists with that email. Try signing in instead.",
  "auth/weak-password": "Choose a password with at least 8 characters.",
  "auth/user-disabled": "That account has been disabled.",
  "auth/too-many-requests":
    "Too many attempts. Wait a few minutes and try again.",
  "auth/network-request-failed":
    "We couldn't reach the network. Check your connection and try again.",
  "auth/popup-blocked":
    "Your browser blocked the sign-in window. Allow popups and try again.",
  "auth/account-exists-with-different-credential":
    "You signed up with Google. Use Continue with Google instead.",
  "auth/operation-not-allowed":
    "That sign-in method isn't enabled for this project yet.",
  "auth/requires-recent-login": "Please sign in again to continue.",

  // Configuration faults. These are our mistakes, not the user's, so the copy
  // says so plainly rather than implying they typed something wrong. Each one
  // names a specific thing to fix in the Firebase console.
  "auth/unauthorized-domain":
    "Sign-in isn't allowed from this address yet. If you're the site owner, add this domain to Firebase Authentication → Settings → Authorized domains.",
  "auth/invalid-api-key":
    "Sign-in isn't configured correctly. Check the Firebase web API key.",
  "auth/configuration-not-found":
    "Sign-in isn't configured yet. Enable this provider in the Firebase console.",

  // Environment faults, distinct from a network failure: retrying helps here
  // only if the user changes something.
  "auth/web-storage-unsupported":
    "Your browser is blocking the storage sign-in needs. Try leaving private browsing or allowing cookies.",
  "auth/popup-blocked-by-browser":
    "Your browser blocked the sign-in window. Allow popups and try again.",
  "auth/timeout": "That took too long. Please try again.",
  "auth/internal-error": "Sign-in failed unexpectedly. Please try again.",
};

/** Codes that mean the user backed out, which should show no error at all. */
const SILENT = new Set([
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
  "auth/user-cancelled",
]);

export function authErrorCode(caught: unknown): string {
  if (typeof caught === "object" && caught && "code" in caught) {
    return String((caught as { code: unknown }).code);
  }
  return "";
}

const GENERIC = "Something went wrong. Please try again.";

/** Returns `CANCELLED` when the user dismissed the flow themselves. */
export function authErrorMessage(caught: unknown): string {
  const code = authErrorCode(caught);
  if (SILENT.has(code)) return CANCELLED;
  if (MESSAGES[code]) return MESSAGES[code]!;

  // An unmapped `code` means this came from Firebase, whose raw messages carry
  // internals like "INVALID_LOGIN_CREDENTIALS". Log it so the gap is fixable,
  // but never show it. Errors without a code are ours — thrown by the session
  // exchange with copy already written for the user — so those pass through.
  if (code) {
    console.warn(`[auth] unmapped error code: ${code}`);
    return GENERIC;
  }

  if (caught instanceof Error && caught.message) return caught.message;
  return GENERIC;
}
