"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signInWithPopup } from "firebase/auth";
import { buttonClasses } from "@/components/ui/Button";
import { GoogleGlyph } from "@/components/ui/GoogleGlyph";
import { CANCELLED, authErrorMessage } from "@/lib/auth/errors";
import { establishSessionCookie } from "@/lib/auth/establishCookie";
import {
  getClientAuth,
  googleProvider,
  isFirebaseClientConfigured,
} from "@/lib/firebase/client";

/**
 * Google sign-in straight from the landing page.
 *
 * Self-contained on purpose: there is no `AuthProvider` above the marketing
 * page, because reading the session in the root layout would opt the whole page
 * into dynamic rendering. Everything here runs in the browser after hydration,
 * so the page stays static.
 *
 * A popup rather than a redirect, matching the rest of the app — it keeps this
 * page alive underneath, so a cancelled sign-in returns the visitor exactly
 * where they were instead of to a reloaded landing page.
 */
export function GetStartedButton({ next = "/practice" }: { next?: string }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = useCallback(async () => {
    setError(null);
    setIsPending(true);
    try {
      const auth = getClientAuth();

      // Someone who is already signed in should not be asked again. Their
      // server cookie may still have expired, so it is re-minted either way.
      const user = auth.currentUser ?? (await signInWithPopup(auth, googleProvider())).user;

      await establishSessionCookie(user);
      router.push(next);
      // The destination renders from the cookie, which the router has not seen
      // yet on this navigation.
      router.refresh();
    } catch (caught) {
      const message = authErrorMessage(caught);
      // Backing out of the popup is a decision, not a failure.
      if (message !== CANCELLED) setError(message);
      setIsPending(false);
    }
  }, [next, router]);

  // Without a web config there is nothing to sign into, so fall back to the
  // sign-up page rather than rendering a button that can only fail.
  if (!isFirebaseClientConfigured()) {
    return (
      <Link href="/signup" className={buttonClasses("ghost")}>
        <GoogleGlyph />
        Get started with Google
      </Link>
    );
  }

  return (
    <span className="inline-flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={() => void onClick()}
        disabled={isPending}
        className={buttonClasses("ghost", "disabled:cursor-not-allowed disabled:opacity-60")}
      >
        <GoogleGlyph />
        {isPending ? "Opening Google…" : "Get started with Google"}
      </button>
      {error ? (
        <span role="alert" className="max-w-[22rem] text-[0.8rem] leading-[1.5] text-ember-deep">
          {error}
        </span>
      ) : null}
    </span>
  );
}
