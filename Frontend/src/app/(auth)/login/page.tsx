import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import LoginForm from "@/components/auth/LoginForm";
import { auth, isGoogleEnabled } from "@/lib/auth";

export const metadata: Metadata = { title: "Log in · EduHub" };

export default async function LoginPage() {
  if (await auth.api.getSession({ headers: await headers() })) redirect("/home");
  return <LoginForm googleEnabled={isGoogleEnabled} />;
}
