"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button, Card, Checkbox, FieldError, Input, Label, Modal, Spinner, TextArea, TextField, buttonVariants } from "@heroui/react";
import { usersApi, type Me } from "@/api/users.api";
import SettingRow from "@/components/Settings/SettingRow";
import TwoFactorSettings from "@/components/Settings/TwoFactorSettings";
import { authClient } from "@/lib/auth-client";
import { getApiErrorMessage } from "@/utils/apiError";
import { LIMITS, validateEmail, validateName, validatePassword } from "@/utils/validation";

const when = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

const authError = (error: { message?: string } | null | undefined, fallback: string) => error?.message || fallback;

function ErrorLine({ text }: { text: string | null }) {
  return text ? <p className="m-0 mt-3 text-sm text-danger" role="alert">{text}</p> : null;
}

/** A group of settings: its name on the left, its rows in one card on the right. */
function Section({ id, title, description, children }: { id: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 py-8 md:grid-cols-[280px_minmax(0,1fr)] md:gap-10" aria-labelledby={`${id}-heading`}>
      <div>
        <h2 id={`${id}-heading`} className="m-0 text-base font-medium">{title}</h2>
        <p className="m-0 mt-1 text-sm text-muted">{description}</p>
      </div>
      <Card className="gap-0 divide-y divide-separator p-0">{children}</Card>
    </section>
  );
}

/** A setting that can be changed: its current value, or its form once asked for. */
function EditableRow({ title, openTitle, detail, leading, action, isOpen, isDisabled, onOpen, notice, children }: {
  title: React.ReactNode; openTitle: string; detail?: React.ReactNode; leading?: React.ReactNode; action: string; isOpen: boolean;
  isDisabled?: boolean; onOpen: () => void; notice?: string | null; children: React.ReactNode;
}) {
  const button = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  // the form held the focus; give it back to the button unless another form has already taken it
  useEffect(() => {
    if (wasOpen.current && !isOpen && document.activeElement === document.body) button.current?.focus();
    wasOpen.current = isOpen;
  }, [isOpen]);

  if (isOpen) {
    return <SettingRow title={openTitle}><div className="settings-reveal mt-4">{children}</div></SettingRow>;
  }
  return (
    <SettingRow title={title} leading={leading}
      detail={<>{detail}{notice && <p className="m-0 mt-1 text-success" role="status">{notice}</p>}</>}
      control={(
        <Button ref={button} size="sm" variant="outline" isDisabled={isDisabled} onPress={onOpen}>
          {action}<span className="sr-only"> {openTitle.split(" ").slice(1).join(" ")}</span>
        </Button>
      )} />
  );
}

/** Save and Cancel sit together, because they are one decision. */
function FormActions({ saveLabel, busy, onCancel }: { saveLabel: string; busy: boolean; onCancel: () => void }) {
  return (
    <div className="flex gap-2">
      <Button type="submit" isPending={busy}>{saveLabel}</Button>
      <Button variant="ghost" isDisabled={busy} onPress={onCancel}>Cancel</Button>
    </div>
  );
}

function ProfileForm({ name, me, onDone, onCancel }: { name: string; me: Me | null; onDone: (notice: string) => void; onCancel: () => void }) {
  const [fullName, setFullName] = useState(name);
  const [headline, setHeadline] = useState(me?.headline ?? "");
  const [bio, setBio] = useState(me?.bio ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const nameError = validateName(fullName);
    if (nameError) return setError(nameError);
    setBusy(true);
    setError(null);
    try {
      if (fullName.trim() !== name) {
        const { error: failure } = await authClient.updateUser({ name: fullName.trim() });
        if (failure) throw new Error(authError(failure, "Couldn't change your name"));
      }
      await usersApi.updateProfile(headline.trim(), bio.trim());
      onDone("Profile saved");
    } catch (failure) {
      setError(getApiErrorMessage(failure, failure instanceof Error ? failure.message : "Couldn't save your profile"));
      setBusy(false);
    }
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={save}>
      <TextField value={fullName} onChange={setFullName} isRequired fullWidth>
        <Label>Name</Label>
        <Input maxLength={LIMITS.name} autoComplete="name" autoFocus />
      </TextField>
      <TextField value={headline} onChange={setHeadline} fullWidth>
        <Label>Headline</Label>
        <Input maxLength={LIMITS.headline} placeholder="Data analyst and SQL teacher" />
      </TextField>
      <TextField value={bio} onChange={setBio} fullWidth>
        <Label>About you</Label>
        <TextArea rows={4} maxLength={LIMITS.bio} placeholder="Shown on your author page and under your courses" />
      </TextField>
      <ErrorLine text={error} />
      <FormActions saveLabel="Save profile" busy={busy} onCancel={onCancel} />
    </form>
  );
}

function EmailForm({ email, onDone, onCancel }: { email: string; onDone: (notice: string) => void; onCancel: () => void }) {
  const [newEmail, setNewEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const problem = validateEmail(newEmail) ?? (newEmail.trim().toLowerCase() === email.toLowerCase() ? "That's already your email." : null);
    if (problem) return setError(problem);
    setBusy(true);
    const { error: failure } = await authClient.changeEmail({ newEmail: newEmail.trim(), callbackURL: "/settings" });
    if (failure) {
      setError(authError(failure, "Couldn't start the change. Try again."));
      setBusy(false);
    } else {
      onDone(`Check ${email}: confirm the change there, then confirm ${newEmail.trim()} from its own email.`);
    }
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={save}>
      <p className="m-0 text-sm text-muted">Currently {email}</p>
      <TextField value={newEmail} onChange={setNewEmail} type="email" fullWidth>
        <Label>New email</Label>
        <Input autoComplete="email" autoFocus />
      </TextField>
      <ErrorLine text={error} />
      <FormActions saveLabel="Send confirmation link" busy={busy} onCancel={onCancel} />
    </form>
  );
}

function PasswordForm({ onDone, onCancel }: { onDone: (notice: string) => void; onCancel: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextError = next ? validatePassword(next, { isNew: true }) : null;

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const problem = validatePassword(current, { isNew: false }) ?? validatePassword(next, { isNew: true });
    if (problem) return setError(problem);
    setBusy(true);
    // other devices are signed out: if the password leaked, whoever used it loses access too
    const { error: failure } = await authClient.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: true });
    if (failure) {
      setError(authError(failure, "Couldn't change your password"));
      setBusy(false);
    } else {
      onDone("Password changed. Your other devices were signed out.");
    }
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={save}>
      <TextField value={current} onChange={setCurrent} type="password" fullWidth>
        <Label>Current password</Label>
        <Input autoComplete="current-password" autoFocus />
      </TextField>
      <TextField value={next} onChange={setNext} type="password" isInvalid={Boolean(nextError)} fullWidth>
        <Label>New password</Label>
        <Input autoComplete="new-password" maxLength={LIMITS.passwordMax} />
        {nextError ? <FieldError>{nextError}</FieldError> : <p className="m-0 text-xs text-muted">At least {LIMITS.passwordMin} characters. Passwords from known data breaches are refused.</p>}
      </TextField>
      <ErrorLine text={error} />
      <FormActions saveLabel="Change password" busy={busy} onCancel={onCancel} />
    </form>
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

function DeviceRows({ current }: { current: SessionRow }) {
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [needsFreshLogin, setNeedsFreshLogin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => authClient.listSessions().then(({ data, error: failure }) => {
    // Better Auth lists devices only for a sign-in from the last day; this device is known either way
    if (failure?.code === "SESSION_NOT_FRESH") {
      setNeedsFreshLogin(true);
      setSessions([current]);
    } else if (failure) setError(authError(failure, "Couldn't load your devices"));
    else setSessions((data ?? []) as SessionRow[]);
  });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, []);

  const revoke = async (token: string) => {
    const { error: failure } = await authClient.revokeSession({ token });
    if (failure) setError(authError(failure, "Couldn't sign that device out"));
    void load();
  };
  const revokeOthers = async () => {
    const { error: failure } = await authClient.revokeOtherSessions();
    if (failure) setError(authError(failure, "Couldn't sign the other devices out"));
    void load();
  };

  if (!sessions && !error) return <SettingRow title="Devices" detail={<span className="flex items-center gap-2"><Spinner size="sm" /> Loading</span>} />;

  return (
    <>
      {sessions?.map((session) => {
        const isCurrent = session.token === current.token;
        return (
          <SettingRow key={session.id}
            title={(
              <span className="flex flex-wrap items-center gap-x-2">
                {describeDevice(session.userAgent)}
                {isCurrent && <span className="inline-flex items-center gap-1.5 text-xs font-normal text-muted"><span className="size-1.5 rounded-full bg-accent" aria-hidden />This device</span>}
              </span>
            )}
            detail={`Signed in ${when.format(new Date(session.createdAt))}${session.ipAddress ? ` · ${session.ipAddress}` : ""}`}
            control={!isCurrent && <Button size="sm" variant="outline" onPress={() => revoke(session.token)}>Sign out</Button>} />
        );
      })}
      {sessions && sessions.length > 1 && (
        <SettingRow title="Other devices" detail="Sign out everywhere except here"
          control={<Button size="sm" variant="outline" onPress={revokeOthers}>Sign out all</Button>} />
      )}
      {needsFreshLogin && <SettingRow title="Other devices" detail="To see them, log out and log in again" />}
      {error && <SettingRow title="Devices"><ErrorLine text={error} /></SettingRow>}
    </>
  );
}

function DownloadRow({ account }: { account: Record<string, unknown> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      const data = { account, ...(await usersApi.exportData() as object) };
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const link = Object.assign(document.createElement("a"), { href: url, download: `eduhub-data-${new Date().toISOString().slice(0, 10)}.json` });
      link.click();
      URL.revokeObjectURL(url);
    } catch (failure) {
      setError(getApiErrorMessage(failure, "Couldn't prepare your data. Try again."));
    }
    setBusy(false);
  };

  return (
    <SettingRow title="Download your data" detail="Profile, courses, progress, notes, quiz results, reviews and comments as a JSON file"
      control={<Button size="sm" variant="outline" isPending={busy} onPress={download}>Download</Button>}>
      <ErrorLine text={error} />
    </SettingRow>
  );
}

/** Rare and permanent, so it asks in a dialog; the account only goes once the emailed link is opened. */
function DeleteRow({ hasPassword }: { hasPassword: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [isSure, setIsSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSent, setIsSent] = useState(false);

  const remove = async () => {
    setBusy(true);
    setError(null);
    const { error: failure } = await authClient.deleteUser({ ...(hasPassword ? { password } : {}), callbackURL: "/?account=deleted" });
    if (failure) setError(authError(failure, "Couldn't start deleting your account"));
    else setIsSent(true);
    setBusy(false);
  };

  return (
    <SettingRow title="Delete account" detail="Removes your account and everything in it for good"
      control={(
        <Modal isOpen={isOpen} onOpenChange={setIsOpen}>
          <Button size="sm" variant="outline" className="text-danger">Delete<span className="sr-only"> account</span></Button>
          <Modal.Backdrop>
            <Modal.Container>
              <Modal.Dialog className="max-w-md">
                <Modal.Header><Modal.Heading>Delete your account?</Modal.Heading></Modal.Header>
                <Modal.Body className="flex flex-col gap-4">
                  {isSent ? (
                    <p className="m-0" role="status">Check your email: open the link there within an hour to delete your account.</p>
                  ) : (
                    <>
                      <p className="m-0 text-sm">Your account, courses (and their learners&rsquo; progress), files, notes, reviews and comments are deleted for good. We email you a link to confirm.</p>
                      {hasPassword && (
                        <TextField value={password} onChange={setPassword} type="password" fullWidth>
                          <Label>Your password</Label>
                          <Input autoComplete="current-password" autoFocus />
                        </TextField>
                      )}
                      <Checkbox isSelected={isSure} onChange={setIsSure}>
                        <Checkbox.Content><Checkbox.Control><Checkbox.Indicator /></Checkbox.Control><span className="text-sm">I understand this can&rsquo;t be undone</span></Checkbox.Content>
                      </Checkbox>
                      <ErrorLine text={error} />
                    </>
                  )}
                </Modal.Body>
                <Modal.Footer>
                  <Button variant="ghost" slot="close" isDisabled={busy}>{isSent ? "Close" : "Cancel"}</Button>
                  {!isSent && <Button variant="danger" isDisabled={!isSure || (hasPassword && !password)} isPending={busy} onPress={remove}>Delete my account</Button>}
                </Modal.Footer>
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </Modal>
      )} />
  );
}

const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]?.toUpperCase() ?? "").join("");

type OpenRow = "profile" | "email" | "password" | null;

function AccountSettings({ hasPassword }: { hasPassword: boolean }) {
  const { data: session, refetch } = authClient.useSession();
  const user = session?.user;
  // undefined while loading; null if the API couldn't be reached (the name can still be changed)
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [open, setOpen] = useState<OpenRow>(null);
  const [notice, setNotice] = useState<{ row: OpenRow; text: string } | null>(null);
  // a password change signs other devices out, so the list is loaded again
  const [devicesVersion, setDevicesVersion] = useState(0);

  const loadMe = () => usersApi.me().then(setMe).catch(() => setMe(null));
  useEffect(() => { void loadMe(); }, []);

  if (!user || !session) {
    return <div className="mt-10 flex items-center justify-center gap-3 py-12 text-muted" role="status"><Spinner size="sm" /> Loading…</div>;
  }

  const openRow = (row: OpenRow) => {
    setNotice(null);
    setOpen(row);
  };
  const finish = (row: OpenRow) => (text: string) => {
    setOpen(null);
    setNotice({ row, text });
  };
  const close = () => setOpen(null);
  const noticeFor = (row: OpenRow) => (notice?.row === row ? notice.text : null);

  return (
    <div className="mt-4 pb-6">
      <section className="flex flex-col gap-2 border-b border-separator pb-8">
        <h1 className="m-0 text-[clamp(28px,4vw,40px)] font-semibold tracking-tight">Settings</h1>
        <p className="m-0 text-muted">Your profile, sign-in and data.</p>
      </section>

      <div className="flex flex-col divide-y divide-separator">

      <Section id="account" title="Account" description="How you appear to others and how you log in">
        <EditableRow title={user.name} openTitle="Edit profile" action="Edit" isOpen={open === "profile"} isDisabled={me === undefined}
          onOpen={() => openRow("profile")} notice={noticeFor("profile")}
          leading={<span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-medium text-accent-soft-foreground" aria-hidden>{initials(user.name)}</span>}
          detail={(
            <>
              {me?.headline && <p className="m-0">{me.headline}</p>}
              {me && <Link href={`/authors/${me.id}`} className="text-accent underline underline-offset-2">View your author page</Link>}
            </>
          )}>
          <ProfileForm name={user.name} me={me ?? null} onCancel={close} onDone={(text) => { finish("profile")(text); void refetch(); void loadMe(); }} />
        </EditableRow>
        <EditableRow title="Email" openTitle="Change email" action="Change" detail={user.email} isOpen={open === "email"}
          onOpen={() => openRow("email")} notice={noticeFor("email")}>
          <EmailForm email={user.email} onCancel={close} onDone={finish("email")} />
        </EditableRow>
        {hasPassword ? (
          <EditableRow title="Password" openTitle="Change password" action="Change" isOpen={open === "password"}
            onOpen={() => openRow("password")} notice={noticeFor("password")}
            detail={<><span aria-hidden>••••••••</span><span className="sr-only">Set</span></>}>
            <PasswordForm onCancel={close} onDone={(text) => { finish("password")(text); setDevicesVersion((v) => v + 1); }} />
          </EditableRow>
        ) : (
          <SettingRow title="Password" detail="You sign in with Google, so it's managed in your Google account" />
        )}
      </Section>

      <Section id="security" title="Security" description="Two-factor sign-in and the devices you're signed in on">
        {hasPassword ? (
          <TwoFactorSettings enabled={Boolean(user.twoFactorEnabled)} onChange={() => refetch()} />
        ) : (
          <SettingRow title="Two-factor authentication" detail="You sign in with Google, so turn on two-step verification there" />
        )}
        <DeviceRows key={devicesVersion} current={session.session} />
      </Section>

      <Section id="data" title="Your data" description="Take a copy, or remove it for good">
        <DownloadRow account={{ name: user.name, email: user.email, email_verified: user.emailVerified, created_at: user.createdAt, two_factor: Boolean(user.twoFactorEnabled) }} />
        <DeleteRow hasPassword={hasPassword} />
      </Section>

      {me?.is_admin && (
        <Section id="moderation" title="Moderation" description="You can handle what people report">
          <SettingRow title="Reports queue" detail="Courses, reviews and comments people flagged"
            control={<Link className={buttonVariants({ size: "sm", variant: "outline" })} href="/moderation">Open</Link>} />
        </Section>
      )}
      </div>
    </div>
  );
}

export default AccountSettings;
