import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { getCurrentUser } from "@/lib/auth/server";
import { isSafeRedirect } from "@/lib/auth/redirects";

export const metadata = {
  title: "Get started — Poise",
};

export const dynamic = "force-dynamic";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const destination = isSafeRedirect(next) ? next! : "/practice";

  const user = await getCurrentUser().catch(() => null);
  if (user) redirect(destination);

  const switchHref = isSafeRedirect(next)
    ? `/signin?next=${encodeURIComponent(next!)}`
    : "/signin";

  return (
    <AuthCard
      title="Get started"
      switchPrompt="Already have an account?"
      switchLabel="Sign in"
      switchHref={switchHref}
    >
      <SignUpForm redirectTo={destination} />
    </AuthCard>
  );
}
