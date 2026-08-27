"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { GoogleButton } from "./GoogleButton";
import { AuthError } from "./SubmitButton";

/**
 * Inline Google sign-in, for the places a full page would lose context — the
 * account menu, and the recorder holding an unsaved recording.
 *
 * Uses the popup flow deliberately: it keeps the current page alive, which is
 * what allows a finished recording to survive sign-in.
 */
export function SignInButton({
  redirectTo,
  label = "Continue with Google",
  className,
  onSignedIn,
}: {
  redirectTo?: string;
  label?: string;
  className?: string;
  onSignedIn?: () => void;
}) {
  const router = useRouter();
  const { signInWithGoogle, isPending } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const handleClick = useCallback(async () => {
    setError(null);
    const result = await signInWithGoogle();

    if (!result.ok) {
      if (!result.cancelled) setError(result.message);
      return;
    }

    onSignedIn?.();
    if (redirectTo) router.replace(redirectTo);
  }, [onSignedIn, redirectTo, router, signInWithGoogle]);

  return (
    <div className={className}>
      <GoogleButton
        label={label}
        disabled={isPending}
        onClick={() => void handleClick()}
      />
      <AuthError message={error} />
    </div>
  );
}
