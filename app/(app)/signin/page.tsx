import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { SignInForm } from "@/components/auth/SignInForm";
import { getCurrentUser } from "@/lib/auth/server";
import { isSafeRedirect } from "@/lib/auth/redirects";

export const metadata = {
  title: "Sign in — Poise",
};

export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const destination = isSafeRedirect(next) ? next! : "/practice";

  const user = await getCurrentUser().catch(() => null);
  if (user) redirect(destination);

  const switchHref = isSafeRedirect(next)
    ? `/signup?next=${encodeURIComponent(next!)}`
    : "/signup";

  return (
    <AuthCard
      title="Sign in"
      switchPrompt="Don't have an account?"
      switchLabel="Get started"
      switchHref={switchHref}
    >
      <SignInForm redirectTo={destination} />
    </AuthCard>
  );
}
