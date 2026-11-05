import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@heroui/react";
import Brand from "@/components/Brand";

export const metadata: Metadata = { title: "Page not found" };

// Unknown URLs answer 404 with a way back, instead of bouncing to another page
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="py-4"><Brand /></header>
      <main className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
        <p className="m-0 text-sm font-medium text-accent">404</p>
        <h1 className="m-0 text-[clamp(28px,4vw,40px)] font-semibold tracking-tight">This page doesn&rsquo;t exist</h1>
        <p className="m-0 max-w-[45ch] text-muted">The link may be mistyped, or the page was moved or removed.</p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <Link className={buttonVariants()} href="/home">Browse courses</Link>
          <Link className={buttonVariants({ variant: "outline" })} href="/">Go to the start page</Link>
        </div>
      </main>
    </div>
  );
}
