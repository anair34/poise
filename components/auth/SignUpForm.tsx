"use client";

import { useCallback, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AuthDivider } from "./AuthCard";
import { GoogleButton } from "./GoogleButton";
import { AuthError, SubmitButton } from "./SubmitButton";
import { useAuth, type AuthResult } from "./AuthProvider";
import { PasswordField, TextField } from "@/components/ui/TextField";

/** Firebase's floor is 6; 8 is the number the field promises the user. */
const MIN_PASSWORD = 8;

export function SignUpForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const { signInWithGoogle, signUpWithEmail, isPending } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const handle = useCallback(
    (result: AuthResult) => {
      if (result.ok) {
        router.replace(redirectTo);
        return;
      }
      setError(result.cancelled ? null : result.message);
    },
    [redirectTo, router],
  );

  const onSubmit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      setError(null);
      setFieldError(null);

      // Checked here rather than left to Firebase: a mismatch is a typo the user
      // should see against the field, not as a server error after a round trip.
      if (password.length < MIN_PASSWORD) {
        setFieldError(`Use at least ${MIN_PASSWORD} characters.`);
        return;
      }
      if (password !== confirm) {
        setFieldError("Those passwords don't match.");
        return;
      }

      handle(await signUpWithEmail({ name, email, password }));
    },
    [confirm, email, handle, name, password, signUpWithEmail],
  );

  const onGoogle = useCallback(async () => {
    setError(null);
    handle(await signInWithGoogle());
  }, [handle, signInWithGoogle]);

  const canSubmit =
    email.trim().length > 0 && password.length > 0 && confirm.length > 0;

  return (
    <div>
      <GoogleButton disabled={isPending} onClick={() => void onGoogle()} />

      <AuthDivider />

      <form onSubmit={onSubmit} noValidate>
        <TextField
          label="Name"
          name="name"
          autoComplete="name"
          placeholder="Optional"
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={isPending}
        />

        <TextField
          className="mt-4"
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
          name="new-password"
          autoComplete="new-password"
          placeholder={`At least ${MIN_PASSWORD} characters`}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={isPending}
          required
        />

        <PasswordField
          className="mt-4"
          label="Confirm password"
          name="confirm-password"
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          disabled={isPending}
          required
          error={fieldError}
        />

        <div className="mt-6">
          <SubmitButton
            disabled={!canSubmit}
            isPending={isPending}
            pendingLabel="Creating your account…"
          >
            Create account
          </SubmitButton>
        </div>
      </form>

      <AuthError message={error} />
    </div>
  );
}
