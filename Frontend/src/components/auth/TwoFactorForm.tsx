"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Checkbox, FieldError, Form, Input, Label, TextField } from "@heroui/react";
import { apiToken } from "@/api/axios.config";
import AuthLayout from "@/components/AuthLayout";
import { authClient } from "@/lib/auth-client";
import { validateBackupCode, validateTotpCode } from "@/utils/validation";

// Better Auth answers both a wrong code and an expired challenge with 401, so tell them apart by code
const CODE_ERRORS: Record<string, string> = {
  INVALID_CODE: "That code didn't work. Check the time on your phone and try again.",
  INVALID_BACKUP_CODE: "That backup code isn't valid or was already used.",
  INVALID_TWO_FACTOR_COOKIE: "This sign-in has expired (it lasts 10 minutes). Log in again.",
};

// Second step of a password sign-in on an account with two-factor turned on
function TwoFactorForm() {
  const [useBackup, setUseBackup] = useState(false);
  const [code, setCode] = useState("");
  const [trustDevice, setTrustDevice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    const value = code.trim();
    const { error: verifyError } = useBackup
      ? await authClient.twoFactor.verifyBackupCode({ code: value, trustDevice })
      : await authClient.twoFactor.verifyTotp({ code: value, trustDevice });
    if (verifyError) {
      setError(CODE_ERRORS[verifyError.code ?? ""] ?? verifyError.message ?? "That code didn't work. Try again.");
      setIsLoading(false);
      return;
    }
    apiToken.clear();
    router.push("/home");
    router.refresh();
  };

  const switchMode = () => {
    setUseBackup(!useBackup);
    setCode("");
    setError(null);
  };

  return (
    <AuthLayout
      title="Two-factor check"
      subtitle={useBackup ? "Enter one of the backup codes you saved. Each code works once." : "Enter the 6-digit code from your authenticator app."}
      switchLink={{ to: "/login", label: "Log in" }}
      footer={<>Lost access? <Link className="font-medium text-link" href="/login">Start over</Link></>}
      error={error}
    >
      <Form className="flex flex-col gap-5" onSubmit={handleSubmit}>
        <TextField
          key={useBackup ? "backup" : "totp"}
          name="code"
          value={code}
          onChange={setCode}
          validate={useBackup ? validateBackupCode : validateTotpCode}
          isRequired
          isDisabled={isLoading}
          autoComplete="one-time-code"
          inputMode={useBackup ? "text" : "numeric"}
          maxLength={useBackup ? 32 : 6}
          autoFocus
          fullWidth
        >
          <Label>{useBackup ? "Backup code" : "Authentication code"}</Label>
          <Input />
          <FieldError />
        </TextField>

        <Checkbox isSelected={trustDevice} onChange={setTrustDevice} isDisabled={isLoading}>
          <Checkbox.Content>
            <Checkbox.Control><Checkbox.Indicator /></Checkbox.Control>
            <Label>Trust this device for 30 days</Label>
          </Checkbox.Content>
        </Checkbox>

        <Button type="submit" size="lg" fullWidth isPending={isLoading}>
          {isLoading ? "Checking…" : "Continue"}
        </Button>
        <Button variant="ghost" fullWidth onPress={switchMode} isDisabled={isLoading}>
          {useBackup ? "Use the authenticator app instead" : "Use a backup code instead"}
        </Button>
      </Form>
    </AuthLayout>
  );
}

export default TwoFactorForm;
