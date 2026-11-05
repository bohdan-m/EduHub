import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import TwoFactorForm from "@/components/auth/TwoFactorForm";
import { auth } from "@/lib/auth";

export const metadata: Metadata = { title: "Two-factor check" };

export default async function TwoFactorPage() {
  if (await auth.api.getSession({ headers: await headers() })) redirect("/home");
  return <TwoFactorForm />;
}
