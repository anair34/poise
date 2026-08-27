import { AuthCard } from "@/components/auth/AuthCard";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const metadata = {
  title: "Reset your password — Poise",
};

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <AuthCard
      title="Reset password"
      switchPrompt="Remembered it?"
      switchLabel="Sign in"
      switchHref="/signin"
    >
      <ResetPasswordForm initialEmail={email ?? ""} />
    </AuthCard>
  );
}
