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

/** Returns `CANCELLED` when the user dismissed the flow themselves. */
export function authErrorMessage(caught: unknown): string {
  const code = authErrorCode(caught);
  if (SILENT.has(code)) return CANCELLED;
  if (MESSAGES[code]) return MESSAGES[code]!;
  if (caught instanceof Error && caught.message) return caught.message;
  return "Something went wrong. Please try again.";
}
