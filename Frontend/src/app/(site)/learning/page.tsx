import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import MyLearning from "@/components/Learning/MyLearning";
import { auth } from "@/lib/auth";

export const metadata: Metadata = { title: "My learning" };

export default async function LearningPage() {
  if (!(await auth.api.getSession({ headers: await headers() }))) redirect("/login");
  return <MyLearning />;
}
