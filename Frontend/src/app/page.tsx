import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

// "/" has no page of its own: send people home if logged in, else to login
export default async function RedirectFromRoot() {
  const session = await auth.api.getSession({ headers: await headers() });
  redirect(session ? "/home" : "/login");
}
