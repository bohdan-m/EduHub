"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button, FieldError, Form, Input, Label, TextField } from "@heroui/react";
import AuthLayout from "@/components/AuthLayout";
import { authClient } from "@/lib/auth-client";
import { validateEmail } from "@/utils/validation";

function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    // the email link opens Better Auth's /reset-password/:token, which forwards here with ?token=
    const { error: requestError } = await authClient.requestPasswordReset({ email: email.trim(), redirectTo: "/reset-password" });
    setIsLoading(false);
    if (requestError) {
      setError(requestError.message ?? "Couldn't send the email. Try again in a minute.");
      return;
    }
    setSentTo(email.trim());
  };

  // the same answer whether or not the address has an account, so this page can't be used to look up accounts
  if (sentTo) {
    return (
      <AuthLayout
        title="Check your email"
        subtitle={`If ${sentTo} has an EduHub account, we sent it a link to choose a new password. The link works for an hour.`}
        switchLink={{ to: "/login", label: "Log in" }}
        footer={<>Remembered it? <Link className="font-medium text-link" href="/login">Log in</Link></>}
        error={null}
      >
        <Button variant="outline" fullWidth onPress={() => setSentTo(null)}>Use a different email</Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter the email you signed up with and we'll send you a link to choose a new password."
      switchLink={{ to: "/login", label: "Log in" }}
      footer={<>Remembered it? <Link className="font-medium text-link" href="/login">Log in</Link></>}
      error={error}
    >
      <Form method="post" className="flex flex-col gap-5" onSubmit={handleSubmit}>
        <TextField name="email" type="email" value={email} onChange={setEmail} validate={validateEmail} isRequired isDisabled={isLoading} autoComplete="email" autoFocus fullWidth>
          <Label>Email</Label>
          <Input />
          <FieldError />
        </TextField>
        <Button type="submit" size="lg" fullWidth isPending={isLoading}>
          {isLoading ? "Sending…" : "Send reset link"}
        </Button>
      </Form>
    </AuthLayout>
  );
}

export default ForgotPasswordForm;
