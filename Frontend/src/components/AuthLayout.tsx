import type { ReactNode } from "react";
import Link from "next/link";
import { Alert, buttonVariants } from "@heroui/react";
import { IconAlertCircle } from "@tabler/icons-react";
import Brand from "@/components/Brand";
import ThemeToggle from "@/components/ThemeToggle";

type AuthLayoutProps = {
  title: string;
  subtitle: string;
  switchLink: { to: string; label: string };
  footer: ReactNode;
  error: string | null;
  children: ReactNode;
};

function AuthLayout({ title, subtitle, switchLink, footer, error, children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between gap-4 py-4">
        <Brand />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link className={buttonVariants({ variant: "ghost", size: "sm", className: "text-muted" })} href={switchLink.to}>
            {switchLink.label}
          </Link>
        </div>
      </header>

      <div className="m-auto w-full max-w-sm pt-8 pb-16">
        <h1 className="m-0 mb-2 text-[28px] font-semibold">{title}</h1>
        <p className="m-0 mb-8 text-muted">{subtitle}</p>

        {error && (
          <Alert status="danger" className="mb-5">
            <Alert.Indicator><IconAlertCircle size={20} /></Alert.Indicator>
            <Alert.Content>
              <Alert.Description>{error}</Alert.Description>
            </Alert.Content>
          </Alert>
        )}

        {children}

        <p className="mt-6 text-center text-sm text-muted">{footer}</p>
      </div>
    </div>
  );
}

export default AuthLayout;
