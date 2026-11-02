"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useUserStore } from "@/store/store";
import { authApi } from "@/api/auth.api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Form, Input, Label, TextField } from "@heroui/react";
import axios from "axios";
import AuthLayout from "@/components/AuthLayout";

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const { user, setUser } = useUserStore();

  useEffect(() => {
    if (user) {
      router.push("/home")
    }
  }, [user, router])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await authApi.login({ username, password });
      setUser(response);
      router.push("/home")
    } catch (err: unknown) {
      let errorMessage = "Couldn't log in. Check your username and password.";

      if (axios.isAxiosError(err)) {
        errorMessage =
          err.response?.data?.detail ??
          err.response?.data?.message ??
          errorMessage;
      }

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Log in to EduHub"
      subtitle="Pick up your courses where you left off."
      switchLink={{ to: "/register", label: "Create account" }}
      footer={<>New to EduHub? <Link className="font-medium text-link" href="/register">Create an account</Link></>}
      error={error}
    >
      <Form className="flex flex-col gap-5" onSubmit={handleSubmit}>
        <TextField
          name="username"
          value={username}
          onChange={setUsername}
          isRequired
          isDisabled={isLoading}
          autoComplete="username"
          fullWidth
        >
          <Label>Username</Label>
          <Input autoCapitalize="none" />
        </TextField>

        <TextField
          name="password"
          type="password"
          value={password}
          onChange={setPassword}
          isRequired
          isDisabled={isLoading}
          autoComplete="current-password"
          fullWidth
        >
          <Label>Password</Label>
          <Input />
        </TextField>

        <Button type="submit" size="lg" fullWidth isPending={isLoading} className="mt-2">
          {isLoading ? "Logging in…" : "Log in"}
        </Button>
      </Form>
    </AuthLayout>
  );
}

export default Login;
