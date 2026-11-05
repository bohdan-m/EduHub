"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button, FieldError, Form, Input, Label, TextField } from "@heroui/react";
import AuthLayout from "@/components/AuthLayout";
import CheckEmail from "@/components/auth/CheckEmail";
import GoogleButton, { OrDivider } from "@/components/auth/GoogleButton";
import { authClient } from "@/lib/auth-client";
import { validateEmail, validateName, validatePassword } from "@/utils/validation";

function RegisterForm({ googleEnabled }: { googleEnabled: boolean }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    // no session yet: the account opens once the emailed link is followed (it signs the user in)
    const { error: signUpError } = await authClient.signUp.email({ name: name.trim(), email, password, callbackURL: "/login" });
    setIsLoading(false);
    if (signUpError) {
      setError(signUpError.message ?? "Couldn't create the account. Check your details and try again.");
      return;
    }
    setSentTo(email.trim());
  };

  if (sentTo) return <CheckEmail email={sentTo} />;

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Build courses for yourself and keep everything you learn in one place."
      switchLink={{ to: "/login", label: "Log in" }}
      footer={<>Already have an account? <Link className="font-medium text-link" href="/login">Log in</Link></>}
      error={error}
    >
      <div className="flex flex-col gap-5">
        {googleEnabled && (
          <>
            <GoogleButton isDisabled={isLoading} />
            <OrDivider />
          </>
        )}

        <Form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          <TextField name="name" value={name} onChange={setName} validate={validateName} isRequired isDisabled={isLoading} autoComplete="name" maxLength={100} fullWidth>
            <Label>Name</Label>
            <Input />
            <FieldError />
          </TextField>

          <TextField name="email" type="email" value={email} onChange={setEmail} validate={validateEmail} isRequired isDisabled={isLoading} autoComplete="email" fullWidth>
            <Label>Email</Label>
            <Input />
            <FieldError />
          </TextField>

          <TextField
            name="password"
            type="password"
            value={password}
            onChange={setPassword}
            validate={(value) => validatePassword(value, { isNew: true })}
            isRequired
            isDisabled={isLoading}
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            fullWidth
          >
            <Label>Password</Label>
            <Input />
            <FieldError />
          </TextField>

          <Button type="submit" size="lg" fullWidth isPending={isLoading} className="mt-2">
            {isLoading ? "Creating account…" : "Create account"}
          </Button>
        </Form>
      </div>
    </AuthLayout>
  );
}

export default RegisterForm;
