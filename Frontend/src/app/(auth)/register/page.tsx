import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import RegisterForm from "@/components/auth/RegisterForm";
import { auth, isGoogleEnabled } from "@/lib/auth";

export const metadata: Metadata = { title: "Create account · EduHub" };

export default async function RegisterPage() {
  if (await auth.api.getSession({ headers: await headers() })) redirect("/home");
  return <RegisterForm googleEnabled={isGoogleEnabled} />;
}
