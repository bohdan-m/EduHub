"use client";

import { useState } from "react";
import { Button } from "@heroui/react";
import { IconBrandGoogle } from "@tabler/icons-react";
import { authClient } from "@/lib/auth-client";

// Redirects to Google and back; new Google accounts join as students
function GoogleButton({ isDisabled }: { isDisabled?: boolean }) {
  const [isRedirecting, setIsRedirecting] = useState(false);

  const signIn = async () => {
    setIsRedirecting(true);
    const { error } = await authClient.signIn.social({ provider: "google", callbackURL: "/home", errorCallbackURL: "/login" });
    if (error) setIsRedirecting(false);
  };

  return (
    <Button variant="outline" size="lg" fullWidth isPending={isRedirecting} isDisabled={isDisabled} onPress={signIn}>
      <IconBrandGoogle size={18} aria-hidden />
      Continue with Google
    </Button>
  );
}

export function OrDivider() {
  return (
    <div className="flex items-center gap-3 text-sm text-muted" role="separator">
      <span className="h-px flex-1 bg-separator" />
      or
      <span className="h-px flex-1 bg-separator" />
    </div>
  );
}

export default GoogleButton;
