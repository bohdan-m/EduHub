"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import QRCode from "react-qr-code";
import { Alert, Button, Card, FieldError, Form, Input, Label, Switch, TextField } from "@heroui/react";
import { IconAlertCircle, IconCheck, IconCopy, IconShieldLock } from "@tabler/icons-react";
import { authClient } from "@/lib/auth-client";
import { validatePassword, validateTotpCode } from "@/utils/validation";

type Step =
  | { name: "idle" }
  | { name: "password"; action: "enable" | "disable" }
  | { name: "scan"; totpURI: string; backupCodes: string[] };

const secretFrom = (totpURI: string) => new URL(totpURI).searchParams.get("secret") ?? "";

function SetupStep({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-soft-foreground" aria-hidden>{n}</span>
      <div className="min-w-0 flex-1">
        <p className="m-0 mb-3 text-sm font-medium">{title}</p>
        {children}
      </div>
    </li>
  );
}

// Turning it on takes the password, then one code from the app, so a mistyped setup never locks the account
function TwoFactorSettings({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  const [step, setStep] = useState<Step>({ name: "idle" });
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyCodes = async (codes: string[]) => {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopied(true);
    } catch {
      setError("Couldn't copy. Select the codes and copy them by hand.");
    }
  };

  const reset = () => {
    setStep({ name: "idle" });
    setPassword("");
    setCode("");
    setError(null);
    setCopied(false);
  };

  const submitPassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (step.name !== "password") return;
    setError(null);
    setIsLoading(true);
    if (step.action === "enable") {
      const { data, error: enableError } = await authClient.twoFactor.enable({ password });
      setIsLoading(false);
      if (enableError || data?.method !== "totp") return setError(enableError?.message ?? "Couldn't start the setup. Try again.");
      setPassword("");
      setStep({ name: "scan", totpURI: data.totpURI, backupCodes: data.backupCodes });
    } else {
      const { error: disableError } = await authClient.twoFactor.disable({ password });
      setIsLoading(false);
      if (disableError) return setError(disableError.message ?? "Couldn't turn it off. Try again.");
      reset();
      onChange();
    }
  };

  const submitCode = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    const { error: verifyError } = await authClient.twoFactor.verifyTotp({ code: code.trim() });
    setIsLoading(false);
    if (verifyError) {
      return setError(verifyError.code === "INVALID_CODE" || !verifyError.message
        ? "That code didn't work. Check the time on your phone and try again."
        : verifyError.message);
    }
    reset();
    onChange();
  };

  const errorAlert = error && (
    <Alert status="danger">
      <Alert.Indicator><IconAlertCircle size={20} /></Alert.Indicator>
      <Alert.Content><Alert.Description>{error}</Alert.Description></Alert.Content>
    </Alert>
  );

  // the switch shows where the user is heading; flipping it back mid-setup cancels
  const isOn = step.name === "idle" ? enabled : step.name === "scan" || step.action === "enable";
  const toggle = () => (step.name === "idle" ? setStep({ name: "password", action: enabled ? "disable" : "enable" }) : reset());

  return (
    <Card className="p-0">
      <div className="flex items-start gap-4 p-5 sm:p-6">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-soft-foreground" aria-hidden>
          <IconShieldLock size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="m-0 text-base font-semibold">Two-factor authentication</h3>
          <p className="m-0 mt-1 text-sm text-muted">
            {enabled
              ? "On. Logging in with your password also asks for a code from your authenticator app."
              : "Ask for a code from an authenticator app (Google Authenticator, 1Password, Authy) when you log in with your password."}
          </p>
        </div>
        <Switch className="mt-1 shrink-0" isSelected={isOn} onChange={toggle} isDisabled={isLoading} aria-label="Two-factor authentication">
          <Switch.Content>
            <Switch.Control><Switch.Thumb /></Switch.Control>
          </Switch.Content>
        </Switch>
      </div>

      {step.name !== "idle" && (
        <div className="border-t border-separator p-5 sm:p-6">
          {step.name === "password" && (
            <Form className="flex max-w-sm flex-col gap-4" onSubmit={submitPassword}>
              {errorAlert}
              <TextField
                name="password"
                type="password"
                value={password}
                onChange={setPassword}
                validate={(value) => validatePassword(value, { isNew: false })}
                isRequired
                isDisabled={isLoading}
                autoComplete="current-password"
                autoFocus
                fullWidth
              >
                <Label>{step.action === "enable" ? "Enter your password to set it up" : "Enter your password to turn it off"}</Label>
                <Input />
                <FieldError />
              </TextField>
              <div className="flex gap-2">
                <Button type="submit" isPending={isLoading} variant={step.action === "enable" ? "primary" : "danger"}>{step.action === "enable" ? "Continue" : "Turn off"}</Button>
                <Button variant="ghost" onPress={reset} isDisabled={isLoading}>Cancel</Button>
              </div>
            </Form>
          )}

          {step.name === "scan" && (
            <Form className="flex flex-col gap-6" onSubmit={submitCode}>
              <ol className="m-0 flex list-none flex-col gap-6 p-0">
                <SetupStep n={1} title="Scan this QR code with your authenticator app">
                  <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                    <div className="shrink-0 rounded-xl border border-separator bg-white p-3">
                      <QRCode value={step.totpURI} size={144} title="Authenticator setup QR code" />
                    </div>
                    <div className="min-w-0 text-sm">
                      <p className="m-0 text-muted">Can&rsquo;t scan it? Enter this key in the app instead:</p>
                      <code className="mt-2 block break-all rounded-lg bg-default px-3 py-2 font-mono text-xs text-foreground">{secretFrom(step.totpURI)}</code>
                    </div>
                  </div>
                </SetupStep>
                <SetupStep n={2} title="Save your backup codes">
                  <p className="m-0 text-sm text-muted">If you lose your phone, each code signs you in once. Keep them somewhere safe, like a password manager.</p>
                  <ul className="m-0 mt-3 grid max-w-sm list-none grid-cols-2 gap-x-6 gap-y-1.5 rounded-xl border border-separator p-4 font-mono text-sm" aria-label="Backup codes">
                    {step.backupCodes.map((backupCode) => <li key={backupCode}>{backupCode}</li>)}
                  </ul>
                  <Button className="mt-3" size="sm" variant="outline" onPress={() => copyCodes(step.backupCodes)}>
                    {copied ? <IconCheck size={16} aria-hidden /> : <IconCopy size={16} aria-hidden />}
                    {copied ? "Copied" : "Copy codes"}
                  </Button>
                </SetupStep>
                <SetupStep n={3} title="Enter the 6-digit code the app shows">
                  <TextField
                    name="code"
                    value={code}
                    onChange={setCode}
                    validate={validateTotpCode}
                    isRequired
                    isDisabled={isLoading}
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    maxLength={6}
                    aria-label="Authentication code"
                    className="max-w-40"
                  >
                    <Input placeholder="123456" className="font-mono tracking-widest" />
                    <FieldError />
                  </TextField>
                </SetupStep>
              </ol>
              {errorAlert}
              <div className="flex gap-2">
                <Button type="submit" isPending={isLoading}>Turn on</Button>
                <Button variant="ghost" onPress={reset} isDisabled={isLoading}>Cancel</Button>
              </div>
            </Form>
          )}
        </div>
      )}
    </Card>
  );
}

export default TwoFactorSettings;
