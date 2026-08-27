"use client";

import { useCallback, useState, type FormEvent } from "react";
import Link from "next/link";
import { AuthError, SubmitButton } from "./SubmitButton";
import { useAuth } from "./AuthProvider";
import { TextField } from "@/components/ui/TextField";

export function ResetPasswordForm({
  initialEmail = "",
}: {
  initialEmail?: string;
}) {
  const { sendReset, isPending } = useAuth();
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState<string | null>(null);
  const [isSent, setIsSent] = useState(false);

  const onSubmit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      setError(null);
      const result = await sendReset(email);
      if (result.ok) {
        setIsSent(true);
        return;
      }
      if (!result.cancelled) setError(result.message);
    },
    [email, sendReset],
  );

  if (isSent) {
    return (
      <div>
        <p className="text-[0.95rem] leading-[1.65] text-ink-soft">
          If an account exists for{" "}
          <span className="font-medium text-ink">{email.trim()}</span>, a reset
          link is on its way. Check your spam folder if it doesn&apos;t arrive in
          a few minutes.
        </p>
        <Link
          href="/signin"
          className="mt-6 inline-block text-[0.88rem] font-medium text-ember transition-colors duration-200 hover:text-ember-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember/40"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
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

        <div className="mt-6">
          <SubmitButton
            disabled={email.trim().length === 0}
            isPending={isPending}
            pendingLabel="Sending…"
          >
            Send reset link
          </SubmitButton>
        </div>
      </form>

      <AuthError message={error} />

      <Link
        href="/signin"
        className="mt-6 inline-block text-[0.85rem] text-ink-muted transition-colors duration-200 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember/40"
      >
        Back to sign in
      </Link>
    </div>
  );
}
