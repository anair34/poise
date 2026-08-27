/**
 * Guards the `?next=` parameter used to return someone to where they were
 * headed before signing in.
 *
 * Without this check, `/signin?next=https://evil.example` would turn our own
 * sign-in page into a credible redirect to someone else's, which is the classic
 * open-redirect phishing setup. Only same-site absolute paths are allowed.
 */
export function isSafeRedirect(target: string | null | undefined): boolean {
  if (!target) return false;
  if (!target.startsWith("/")) return false;
  // "//evil.example" and "/\evil.example" are protocol-relative URLs that most
  // browsers resolve off-site.
  if (target.startsWith("//") || target.startsWith("/\\")) return false;
  if (target.includes("://")) return false;
  return true;
}
