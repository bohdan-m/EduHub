"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, FieldError, Form, Input, Label, TextField } from "@heroui/react";
import { apiToken } from "@/api/axios.config";
import AuthLayout from "@/components/AuthLayout";
import CheckEmail from "@/components/auth/CheckEmail";
import GoogleButton, { OrDivider } from "@/components/auth/GoogleButton";
import { authClient } from "@/lib/auth-client";
import { validateEmail, validatePassword } from "@/utils/validation";

// Better Auth sends people back here with ?error=... when an emailed link is expired or already used
const LINK_ERROR = "That link has expired or was already used. Log in to get a new one.";

function LoginForm({ googleEnabled, linkError }: { googleEnabled: boolean; linkError: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(linkError ? LINK_ERROR : null);
  const [isLoading, setIsLoading] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const { data, error: signInError } = await authClient.signIn.email({ email, password, callbackURL: "/login" });
    if (signInError) {
      // the right password on an unconfirmed account: Better Auth has just emailed a fresh link
      if (signInError.code === "EMAIL_NOT_VERIFIED") setUnverifiedEmail(email.trim());
      else setError(signInError.message ?? "Couldn't log in. Check your email and password.");
      setIsLoading(false);
      return;
    }
    apiToken.clear();
    // two-factor accounts get a short-lived challenge cookie instead of a session
    router.push(data && "twoFactorRedirect" in data && data.twoFactorRedirect ? "/two-factor" : "/home");
    router.refresh();
  };

  if (unverifiedEmail) return <CheckEmail email={unverifiedEmail} />;

  return (
    <AuthLayout
      title="Log in to EduHub"
      subtitle="Pick up your courses where you left off."
      switchLink={{ to: "/register", label: "Create account" }}
      footer={<>New to EduHub? <Link className="font-medium text-link" href="/register">Create an account</Link></>}
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
          <TextField name="email" type="email" value={email} onChange={setEmail} validate={validateEmail} isRequired isDisabled={isLoading} autoComplete="email" fullWidth>
            <Label>Email</Label>
            <Input />
            <FieldError />
          </TextField>

          <TextField name="password" type="password" value={password} onChange={setPassword} validate={(value) => validatePassword(value, { isNew: false })} isRequired isDisabled={isLoading} autoComplete="current-password" fullWidth>
            <Label>Password</Label>
            <Input />
            <FieldError />
          </TextField>
          <Link className="-mt-3 self-end text-sm font-medium text-link" href="/forgot-password">Forgot password?</Link>

          <Button type="submit" size="lg" fullWidth isPending={isLoading} className="mt-2">
            {isLoading ? "Logging in…" : "Log in"}
          </Button>
        </Form>
      </div>
    </AuthLayout>
  );
}

export default LoginForm;
