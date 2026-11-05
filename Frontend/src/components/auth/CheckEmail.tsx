"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@heroui/react";
import AuthLayout from "@/components/AuthLayout";
import { authClient } from "@/lib/auth-client";

// After sign-up, or a sign-in on an account whose address isn't confirmed yet (Better Auth has already sent a link)
function CheckEmail({ email }: { email: string }) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  const resend = async () => {
    setStatus("sending");
    setError(null);
    const { error: sendError } = await authClient.sendVerificationEmail({ email, callbackURL: "/login" });
    if (sendError) {
      setError(sendError.message ?? "Couldn't send the email. Try again in a minute.");
      setStatus("idle");
      return;
    }
    setStatus("sent");
  };

  return (
    <AuthLayout
      title="Check your email"
      subtitle={`We sent a confirmation link to ${email}. Open it within an hour to finish signing in.`}
      switchLink={{ to: "/login", label: "Log in" }}
      footer={<>Wrong address? <Link className="font-medium text-link" href="/register">Sign up again</Link></>}
      error={error}
    >
      <div className="flex flex-col gap-3">
        <p className="m-0 text-sm text-muted" role="status">
          {status === "sent" ? "A new link is on its way. Older links stop working." : "Nothing there? Check your spam folder, or send another link."}
        </p>
        <Button variant="outline" fullWidth isPending={status === "sending"} isDisabled={status === "sent"} onPress={resend}>
          {status === "sent" ? "Link sent" : "Send another link"}
        </Button>
      </div>
    </AuthLayout>
  );
}

export default CheckEmail;
