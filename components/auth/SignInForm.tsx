"use client";

import { useCallback, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthDivider } from "./AuthCard";
import { GoogleButton } from "./GoogleButton";
import { AuthError, SubmitButton } from "./SubmitButton";
import { useAuth } from "./AuthProvider";
import { PasswordField, TextField } from "@/components/ui/TextField";
import type { AuthResult } from "./AuthProvider";

export function SignInForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const { signInWithGoogle, signInWithEmail, isPending } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handle = useCallback(
    (result: AuthResult) => {
      if (result.ok) {
        router.replace(redirectTo);
        return;
      }
      // A cancelled popup is a deliberate choice, not a failure to report.
      setError(result.cancelled ? null : result.message);
    },
    [redirectTo, router],
  );

  const onSubmit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      setError(null);
      handle(await signInWithEmail(email, password));
    },
    [email, handle, password, signInWithEmail],
  );

  const onGoogle = useCallback(async () => {
    setError(null);
    handle(await signInWithGoogle());
  }, [handle, signInWithGoogle]);

  const canSubmit = email.trim().length > 0 && password.length > 0;

  return (
    <div>
      <GoogleButton disabled={isPending} onClick={() => void onGoogle()} />

      <AuthDivider />

      <form onSubmit={onSubmit} noValidate>
        <TextField
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="name@email.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={isPending}
          required
        />

        <PasswordField
          className="mt-4"
          label="Password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={isPending}
          required
          action={
            <Link
              href={
                email.trim()
                  ? `/reset-password?email=${encodeURIComponent(email.trim())}`
                  : "/reset-password"
              }
              className="text-[0.8rem] font-medium text-ember transition-colors duration-200 hover:text-ember-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember/40"
            >
              Forgot password?
            </Link>
          }
        />

        <div className="mt-6">
          <SubmitButton
            disabled={!canSubmit}
            isPending={isPending}
            pendingLabel="Signing you in…"
          >
            Continue
          </SubmitButton>
        </div>
      </form>

      <AuthError message={error} />
    </div>
  );
}
