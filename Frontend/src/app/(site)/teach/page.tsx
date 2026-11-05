import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Teaching from "@/components/Learning/Teaching";
import { auth } from "@/lib/auth";

export const metadata: Metadata = { title: "Teach" };

export default async function TeachPage() {
  if (!(await auth.api.getSession({ headers: await headers() }))) redirect("/login");
  return <Teaching />;
}
