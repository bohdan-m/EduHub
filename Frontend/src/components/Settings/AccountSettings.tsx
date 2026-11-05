"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, Checkbox, FieldError, Input, Label, Spinner, TextArea, TextField } from "@heroui/react";
import { IconDeviceDesktop, IconDownload, IconShieldCheck } from "@tabler/icons-react";
import { usersApi, type Me } from "@/api/users.api";
import TwoFactorSettings from "@/components/Settings/TwoFactorSettings";
import { authClient } from "@/lib/auth-client";
import { getApiErrorMessage } from "@/utils/apiError";
import { LIMITS, validateEmail, validateName, validatePassword } from "@/utils/validation";

const when = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

type Status = { kind: "ok" | "error"; text: string } | null;

function StatusLine({ status }: { status: Status }) {
  if (!status) return null;
  return <p className={`m-0 text-sm ${status.kind === "ok" ? "text-success" : "text-danger"}`} role={status.kind === "ok" ? "status" : "alert"}>{status.text}</p>;
}

/** A settings section: a heading outside, a card of content inside. */
function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`} className="m-0 text-sm font-medium text-muted">{title}</h2>
      {children}
    </section>
  );
}

const authError = (error: { message?: string } | null | undefined, fallback: string) => error?.message || fallback;

function ProfileCard({ name, me, onSaved }: { name: string; me: Me | null; onSaved: () => void }) {
  const [fullName, setFullName] = useState(name);
  const [headline, setHeadline] = useState(me?.headline ?? "");
  const [bio, setBio] = useState(me?.bio ?? "");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const nameError = validateName(fullName);
    if (nameError) return setStatus({ kind: "error", text: nameError });
    setBusy(true);
    setStatus(null);
    try {
      if (fullName.trim() !== name) {
        const { error } = await authClient.updateUser({ name: fullName.trim() });
        if (error) throw new Error(authError(error, "Couldn't change your name."));
      }
      await usersApi.updateProfile(headline.trim(), bio.trim());
      setStatus({ kind: "ok", text: "Profile saved." });
      onSaved();
    } catch (failure) {
      setStatus({ kind: "error", text: getApiErrorMessage(failure, failure instanceof Error ? failure.message : "Couldn't save your profile.") });
    }
    setBusy(false);
  };

  return (
    <Card className="p-5 sm:p-6">
      <form className="flex flex-col gap-4" onSubmit={save}>
        <TextField value={fullName} onChange={setFullName} isRequired fullWidth>
          <Label>Name</Label>
          <Input maxLength={LIMITS.name} autoComplete="name" />
        </TextField>
        <TextField value={headline} onChange={setHeadline} fullWidth>
          <Label>Headline</Label>
          <Input maxLength={LIMITS.headline} placeholder="Data analyst and SQL teacher" />
        </TextField>
        <TextField value={bio} onChange={setBio} fullWidth>
          <Label>About you</Label>
          <TextArea rows={4} maxLength={LIMITS.bio} placeholder="Shown on your author page and under your courses." />
        </TextField>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" isPending={busy}>Save profile</Button>
          {me && <Link href={`/authors/${me.id}`} className="text-sm">View your author page</Link>}
        </div>
        <StatusLine status={status} />
      </form>
    </Card>
  );
}

function EmailCard({ email }: { email: string }) {
  const [newEmail, setNewEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const problem = validateEmail(newEmail) ?? (newEmail.trim().toLowerCase() === email.toLowerCase() ? "That's already your email." : null);
    if (problem) return setStatus({ kind: "error", text: problem });
    setBusy(true);
    const { error } = await authClient.changeEmail({ newEmail: newEmail.trim(), callbackURL: "/settings" });
    setStatus(error
      ? { kind: "error", text: authError(error, "Couldn't start the change. Try again.") }
      : { kind: "ok", text: `Check ${email}: confirm the change there, then confirm ${newEmail.trim()} from its own email.` });
    setBusy(false);
  };

  return (
    <Card className="p-5 sm:p-6">
      <form className="flex flex-col gap-4" onSubmit={save}>
        <p className="m-0 text-sm">Current email: <strong className="break-all">{email}</strong></p>
        <TextField value={newEmail} onChange={setNewEmail} type="email" fullWidth>
          <Label>New email</Label>
          <Input autoComplete="email" />
        </TextField>
        <Button type="submit" variant="outline" className="self-start" isPending={busy}>Change email</Button>
        <StatusLine status={status} />
      </form>
    </Card>
  );
}

function PasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const nextError = next ? validatePassword(next, { isNew: true }) : null;

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const problem = validatePassword(current, { isNew: false }) ?? validatePassword(next, { isNew: true });
    if (problem) return setStatus({ kind: "error", text: problem });
    setBusy(true);
    // other devices are signed out: if the password leaked, whoever used it loses access too
    const { error } = await authClient.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: true });
    if (error) {
      setStatus({ kind: "error", text: authError(error, "Couldn't change your password.") });
    } else {
      setCurrent("");
      setNext("");
      setStatus({ kind: "ok", text: "Password changed. Your other devices were signed out." });
    }
    setBusy(false);
  };

  return (
    <Card className="p-5 sm:p-6">
      <form className="flex flex-col gap-4" onSubmit={save}>
        <h3 className="m-0 text-base font-semibold">Password</h3>
        <TextField value={current} onChange={setCurrent} type="password" fullWidth>
          <Label>Current password</Label>
          <Input autoComplete="current-password" />
        </TextField>
        <TextField value={next} onChange={setNext} type="password" isInvalid={Boolean(nextError)} fullWidth>
          <Label>New password</Label>
          <Input autoComplete="new-password" maxLength={LIMITS.passwordMax} />
          {nextError ? <FieldError>{nextError}</FieldError> : <p className="m-0 text-xs text-muted">At least {LIMITS.passwordMin} characters. Passwords from known data breaches are refused.</p>}
        </TextField>
        <Button type="submit" variant="outline" className="self-start" isPending={busy}>Change password</Button>
        <StatusLine status={status} />
      </form>
    </Card>
  );
}

type SessionRow = { id: string; token: string; userAgent?: string | null; ipAddress?: string | null; createdAt: Date | string };

/** "Chrome on Windows" from a user agent; rough, but enough to recognise a device. */
function describeDevice(agent?: string | null) {
  if (!agent) return "Unknown device";
  const browser = /Edg\//.test(agent) ? "Edge" : /Firefox\//.test(agent) ? "Firefox" : /Chrome\//.test(agent) ? "Chrome" : /Safari\//.test(agent) ? "Safari" : "Browser";
  const system = /Windows/.test(agent) ? "Windows" : /Android/.test(agent) ? "Android" : /iPhone|iPad/.test(agent) ? "iOS" : /Mac OS X/.test(agent) ? "macOS" : /Linux/.test(agent) ? "Linux" : "";
  return system ? `${browser} on ${system}` : browser;
}

function SessionsCard({ currentToken }: { currentToken: string }) {
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [status, setStatus] = useState<Status>(null);

  const load = () => authClient.listSessions().then(({ data }) => setSessions((data ?? []) as SessionRow[]));
  useEffect(() => { void load(); }, []);

  const revoke = async (token: string) => {
    const { error } = await authClient.revokeSession({ token });
    if (error) setStatus({ kind: "error", text: authError(error, "Couldn't sign that device out.") });
    void load();
  };
  const revokeOthers = async () => {
    const { error } = await authClient.revokeOtherSessions();
    setStatus(error ? { kind: "error", text: authError(error, "Couldn't sign the other devices out.") } : { kind: "ok", text: "Signed out everywhere else." });
    void load();
  };

  return (
    <Card className="gap-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="m-0 text-base font-semibold">Where you&rsquo;re signed in</h3>
        {sessions && sessions.length > 1 && <Button size="sm" variant="outline" onPress={revokeOthers}>Sign out other devices</Button>}
      </div>
      {!sessions ? <p className="m-0 flex items-center gap-2 text-sm text-muted"><Spinner size="sm" /> Loading…</p> : (
        <ul className="m-0 flex list-none flex-col divide-y divide-separator p-0">
          {sessions.map((session) => {
            const isCurrent = session.token === currentToken;
            return (
              <li key={session.id} className="flex items-center gap-3 py-3">
                <IconDeviceDesktop size={20} className="shrink-0 text-muted" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="m-0 text-sm font-medium">{describeDevice(session.userAgent)}{isCurrent && <span className="ml-2 text-xs font-normal text-success">This device</span>}</p>
                  <p className="m-0 text-xs text-muted">Signed in {when.format(new Date(session.createdAt))}{session.ipAddress ? ` · ${session.ipAddress}` : ""}</p>
                </div>
                {!isCurrent && <Button size="sm" variant="ghost" onPress={() => revoke(session.token)}>Sign out</Button>}
              </li>
            );
          })}
        </ul>
      )}
      <StatusLine status={status} />
    </Card>
  );
}

function DataCard({ account }: { account: Record<string, unknown> }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  const download = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const data = { account, ...(await usersApi.exportData() as object) };
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const link = Object.assign(document.createElement("a"), { href: url, download: `eduhub-data-${new Date().toISOString().slice(0, 10)}.json` });
      link.click();
      URL.revokeObjectURL(url);
    } catch (failure) {
      setStatus({ kind: "error", text: getApiErrorMessage(failure, "Couldn't prepare your data. Try again.") });
    }
    setBusy(false);
  };

  return (
    <Card className="gap-3 p-5 sm:p-6">
      <h3 className="m-0 text-base font-semibold">Download your data</h3>
      <p className="m-0 text-sm text-muted">Your profile, courses, progress, notes, quiz results, reviews and comments, as one JSON file.</p>
      <Button variant="outline" className="self-start" isPending={busy} onPress={download}><IconDownload size={18} aria-hidden /> Download</Button>
      <StatusLine status={status} />
    </Card>
  );
}

function DeleteCard({ hasPassword }: { hasPassword: boolean }) {
  const [password, setPassword] = useState("");
  const [isSure, setIsSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  const remove = async () => {
    setBusy(true);
    setStatus(null);
    const { error } = await authClient.deleteUser({ ...(hasPassword ? { password } : {}), callbackURL: "/?account=deleted" });
    setStatus(error
      ? { kind: "error", text: authError(error, "Couldn't start deleting your account.") }
      : { kind: "ok", text: "Check your email: open the link there within an hour to delete your account." });
    setBusy(false);
  };

  return (
    <Card className="gap-4 border border-danger/30 p-5 sm:p-6">
      <h3 className="m-0 text-base font-semibold text-danger">Delete account</h3>
      <p className="m-0 text-sm">Your account, courses (and their learners&rsquo; progress), files, notes, reviews and comments are deleted for good. We email you a link to confirm.</p>
      {hasPassword && (
        <TextField value={password} onChange={setPassword} type="password" fullWidth>
          <Label>Your password</Label>
          <Input autoComplete="current-password" />
        </TextField>
      )}
      <Checkbox isSelected={isSure} onChange={setIsSure}>
        <Checkbox.Content><Checkbox.Control><Checkbox.Indicator /></Checkbox.Control><span className="text-sm">I understand this can&rsquo;t be undone</span></Checkbox.Content>
      </Checkbox>
      <Button variant="danger" className="self-start" isDisabled={!isSure || (hasPassword && !password)} isPending={busy} onPress={remove}>
        Delete my account
      </Button>
      <StatusLine status={status} />
    </Card>
  );
}

function AccountSettings({ hasPassword }: { hasPassword: boolean }) {
  const { data: session, refetch } = authClient.useSession();
  const user = session?.user;
  // undefined while loading; null if the API couldn't be reached (the name can still be changed)
  const [me, setMe] = useState<Me | null | undefined>(undefined);

  const loadMe = () => usersApi.me().then(setMe).catch(() => setMe(null));
  useEffect(() => { void loadMe(); }, []);

  if (!user || !session) {
    return <div className="mt-10 flex items-center justify-center gap-3 py-12 text-muted" role="status"><Spinner size="sm" /> Loading…</div>;
  }

  return (
    <div className="mx-auto mt-4 flex w-full max-w-2xl flex-col gap-8 pb-12">
      <h1 className="m-0 text-[28px] font-semibold">Settings</h1>

      {me?.is_admin && (
        <Link href="/moderation" className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-medium">
          <IconShieldCheck size={18} className="text-accent" aria-hidden /> Open the moderation queue
        </Link>
      )}

      <Section id="profile" title="Profile">
        {/* rendered once the profile is here, so nothing typed is replaced when it arrives */}
        {me === undefined
          ? <Card className="p-5 sm:p-6"><p className="m-0 flex items-center gap-2 text-sm text-muted"><Spinner size="sm" /> Loading your profile…</p></Card>
          : <ProfileCard name={user.name} me={me} onSaved={() => { void refetch(); void loadMe(); }} />}
      </Section>

      <Section id="email" title="Email">
        <EmailCard email={user.email} />
      </Section>

      <Section id="security" title="Security">
        {hasPassword ? (
          <>
            <PasswordCard />
            <TwoFactorSettings enabled={Boolean(user.twoFactorEnabled)} onChange={() => refetch()} />
          </>
        ) : (
          <Card className="p-5 sm:p-6">
            <h3 className="m-0 text-base font-semibold">Password and two-factor authentication</h3>
            <p className="m-0 mt-1 text-sm text-muted">You sign in with Google, so your password and two-step verification are managed in your Google account.</p>
          </Card>
        )}
        <SessionsCard currentToken={session.session.token} />
      </Section>

      <Section id="data" title="Your data">
        <DataCard account={{ name: user.name, email: user.email, email_verified: user.emailVerified, created_at: user.createdAt, two_factor: Boolean(user.twoFactorEnabled) }} />
        <DeleteCard hasPassword={hasPassword} />
      </Section>
    </div>
  );
}

export default AccountSettings;
