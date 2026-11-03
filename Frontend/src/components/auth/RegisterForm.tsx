"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, FieldError, Form, Input, Label, ListBox, Select, TextField } from "@heroui/react";
import { IconCheck, IconChevronDown } from "@tabler/icons-react";
import { apiToken } from "@/api/axios.config";
import AuthLayout from "@/components/AuthLayout";
import GoogleButton, { OrDivider } from "@/components/auth/GoogleButton";
import { authClient } from "@/lib/auth-client";
import { validateEmail, validateName, validatePassword } from "@/utils/validation";

type Role = "student" | "teacher";

function RegisterForm({ googleEnabled }: { googleEnabled: boolean }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("student");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const { error: signUpError } = await authClient.signUp.email({ name: name.trim(), email, password, role });
    if (signUpError) {
      setError(signUpError.message ?? "Couldn't create the account. Check your details and try again.");
      setIsLoading(false);
      return;
    }
    apiToken.clear();
    router.push("/home");
    router.refresh();
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Join as a student to take courses, or as a teacher to publish them."
      switchLink={{ to: "/login", label: "Log in" }}
      footer={<>Already have an account? <Link className="font-medium text-link" href="/login">Log in</Link></>}
      error={error}
    >
      <div className="flex flex-col gap-5">
        {googleEnabled && (
          <>
            <GoogleButton isDisabled={isLoading} />
            <p className="m-0 -mt-2 text-center text-sm text-muted">Google sign-ups join as students.</p>
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

          <Select value={role} onChange={(value) => value && setRole(value as Role)} isDisabled={isLoading} fullWidth>
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
      </div>
    </AuthLayout>
  );
}

export default RegisterForm;
