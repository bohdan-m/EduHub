import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import LoginForm from "@/components/auth/LoginForm";
import { auth, isGoogleEnabled } from "@/lib/auth";

export const metadata: Metadata = { title: "Log in · EduHub" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  // a followed verification link signs the user in and lands here, so this also finishes email confirmation
  if (await auth.api.getSession({ headers: await headers() })) redirect("/home");
  const { error } = await searchParams;
  return <LoginForm googleEnabled={isGoogleEnabled} linkError={Boolean(error)} />;
}
