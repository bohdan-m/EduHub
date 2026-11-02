"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useUserStore } from "@/store/store";
import { authApi } from "@/api/auth.api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Form, Input, Label, ListBox, Select, TextField } from "@heroui/react";
import { IconCheck, IconChevronDown } from "@tabler/icons-react";
import { getApiErrorMessage } from "@/utils/apiError";
import AuthLayout from "@/components/AuthLayout";

type Role = "student" | "teacher";

function Register() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("student");
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
      const responseRegister = await authApi.register({ username, password, email, role });

      if (responseRegister) {
        const responseLogin = await authApi.login({ username, password });
        setUser(responseLogin);
      };
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Couldn't create the account. Check your details and try again."));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Join as a student to take courses, or as a teacher to publish them."
      switchLink={{ to: "/login", label: "Log in" }}
      footer={<>Already have an account? <Link className="font-medium text-link" href="/login">Log in</Link></>}
      error={error}
    >
      <Form className="flex flex-col gap-5" onSubmit={handleSubmit}>
        <TextField
          name="email"
          type="email"
          value={email}
          onChange={setEmail}
          isRequired
          isDisabled={isLoading}
          autoComplete="email"
          fullWidth
        >
          <Label>Email</Label>
          <Input />
        </TextField>

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
          autoComplete="new-password"
          fullWidth
        >
          <Label>Password</Label>
          <Input />
        </TextField>

        <Select
          value={role}
          onChange={(value) => value && setRole(value as Role)}
          isDisabled={isLoading}
          fullWidth
        >
          <Label>I&rsquo;m joining as</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator><IconChevronDown size={16} /></Select.Indicator>
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id="student" textValue="Student">
                Student
                <ListBox.ItemIndicator>{({ isSelected }) => isSelected && <IconCheck size={16} />}</ListBox.ItemIndicator>
              </ListBox.Item>
              <ListBox.Item id="teacher" textValue="Teacher">
                Teacher
                <ListBox.ItemIndicator>{({ isSelected }) => isSelected && <IconCheck size={16} />}</ListBox.ItemIndicator>
              </ListBox.Item>
            </ListBox>
          </Select.Popover>
        </Select>

        <Button type="submit" size="lg" fullWidth isPending={isLoading} className="mt-2">
          {isLoading ? "Creating account…" : "Create account"}
        </Button>
      </Form>
    </AuthLayout>
  );
}

export default Register;
