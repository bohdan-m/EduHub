"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button, FieldError, Form, Input, Label, TextField, buttonVariants } from "@heroui/react";
import AuthLayout from "@/components/AuthLayout";
import { authClient } from "@/lib/auth-client";
import { LIMITS, validatePassword } from "@/utils/validation";

const BAD_LINK = "This reset link has expired or was already used. Ask for a new one.";

// token is null when Better Auth sent the user here with ?error= (expired or unknown link)
function ResetPasswordForm({ token }: { token: string | null }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(token ? null : BAD_LINK);
  const [isLoading, setIsLoading] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setIsLoading(true);
    const { error: resetError } = await authClient.resetPassword({ newPassword: password, token });
    setIsLoading(false);
    if (resetError) {
      setError(resetError.code === "INVALID_TOKEN" ? BAD_LINK : (resetError.message ?? "Couldn't change the password. Try again."));
      return;
    }
    setIsDone(true);
  };

  if (isDone) {
    return (
      <AuthLayout
        title="Password changed"
        subtitle="You're signed out on every device. Log in with your new password."
        switchLink={{ to: "/login", label: "Log in" }}
        footer={null}
        error={null}
      >
        <Link className={buttonVariants({ size: "lg", fullWidth: true })} href="/login">Log in</Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle="Changing it signs you out everywhere, including any device you don't recognise."
      switchLink={{ to: "/login", label: "Log in" }}
      footer={<>Link not working? <Link className="font-medium text-link" href="/forgot-password">Get a new one</Link></>}
      error={error}
    >
      {token && (
        <Form method="post" className="flex flex-col gap-5" onSubmit={handleSubmit}>
          <TextField
            name="password"
            type="password"
            value={password}
            onChange={setPassword}
            validate={(value) => validatePassword(value, { isNew: true })}
            isRequired
            isDisabled={isLoading}
            autoComplete="new-password"
            minLength={LIMITS.passwordMin}
            maxLength={LIMITS.passwordMax}
            autoFocus
            fullWidth
          >
            <Label>New password</Label>
            <Input />
            <FieldError />
          </TextField>
          <TextField
            name="confirm"
            type="password"
            value={confirm}
            onChange={setConfirm}
            validate={(value) => (value === password ? null : "The passwords don't match.")}
            isRequired
            isDisabled={isLoading}
            autoComplete="new-password"
            fullWidth
          >
            <Label>Repeat the new password</Label>
            <Input />
            <FieldError />
          </TextField>
          <Button type="submit" size="lg" fullWidth isPending={isLoading}>
            {isLoading ? "Saving…" : "Change password"}
          </Button>
        </Form>
      )}
    </AuthLayout>
  );
}

export default ResetPasswordForm;
