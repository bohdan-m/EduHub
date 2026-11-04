import type { Metadata } from "next";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";

export const metadata: Metadata = { title: "Choose a new password · EduHub" };

// Better Auth's emailed link checks the token, then lands here with ?token=… or ?error=INVALID_TOKEN
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token, error } = await searchParams;
  return <ResetPasswordForm token={!error && token ? token : null} />;
}
