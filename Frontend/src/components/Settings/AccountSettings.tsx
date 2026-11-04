"use client";

import { Card, Spinner } from "@heroui/react";
import TwoFactorSettings from "@/components/Settings/TwoFactorSettings";
import { authClient } from "@/lib/auth-client";

function AccountSettings({ hasPassword }: { hasPassword: boolean }) {
  const { data: session, refetch } = authClient.useSession();
  const user = session?.user;

  if (!user) {
    return (
      <div className="mt-10 flex items-center justify-center gap-3 py-12 text-muted" role="status">
        <Spinner size="sm" />
        Loading…
      </div>
    );
  }

  return (
    <div className="mx-auto mt-4 flex w-full max-w-2xl flex-col gap-8 pb-12">
      <h1 className="m-0 text-[28px] font-semibold">Settings</h1>

      <section className="flex flex-col gap-3" aria-labelledby="account-heading">
        <h2 id="account-heading" className="m-0 text-sm font-medium text-muted">Account</h2>
        <Card className="p-0">
          <dl className="m-0 divide-y divide-separator">
            <div className="flex flex-col gap-0.5 px-5 py-4 sm:flex-row sm:gap-6 sm:px-6">
              <dt className="text-sm text-muted sm:w-24 sm:shrink-0">Name</dt>
              <dd className="m-0 min-w-0 break-words">{user.name}</dd>
            </div>
            <div className="flex flex-col gap-0.5 px-5 py-4 sm:flex-row sm:gap-6 sm:px-6">
              <dt className="text-sm text-muted sm:w-24 sm:shrink-0">Email</dt>
              <dd className="m-0 min-w-0 break-all">{user.email}</dd>
            </div>
          </dl>
        </Card>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="security-heading">
        <h2 id="security-heading" className="m-0 text-sm font-medium text-muted">Security</h2>
        {hasPassword ? (
          <TwoFactorSettings enabled={Boolean(user.twoFactorEnabled)} onChange={() => refetch()} />
        ) : (
          <Card className="p-5 sm:p-6">
            <h3 className="m-0 text-base font-semibold">Two-factor authentication</h3>
            <p className="m-0 mt-1 text-sm text-muted">You sign in with Google, so turn on two-step verification in your Google account instead.</p>
          </Card>
        )}
      </section>
    </div>
  );
}

export default AccountSettings;
