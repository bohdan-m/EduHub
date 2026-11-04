import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AccountSettings from "@/components/Settings/AccountSettings";
import { auth } from "@/lib/auth";

export const metadata: Metadata = { title: "Settings · EduHub" };

export default async function SettingsPage() {
  const requestHeaders = await headers();
  if (!(await auth.api.getSession({ headers: requestHeaders }))) redirect("/login");
  // two-factor guards password sign-in, so it is offered only to accounts that have a password
  const accounts = await auth.api.listUserAccounts({ headers: requestHeaders });
  return <AccountSettings hasPassword={accounts.some((account) => account.providerId === "credential")} />;
}
