"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useHasHydrated, useUserStore } from "@/store/store";

// "/" has no page of its own: send people home if logged in, else to login.
// It waits for the saved session to load from localStorage before deciding.
function RedirectFromRoot() {
  const router = useRouter();
  const hasHydrated = useHasHydrated();
  const isAuthenticated = useUserStore((state) => !!state.user?.access);

  useEffect(() => {
    if (hasHydrated) router.replace(isAuthenticated ? "/home" : "/login");
  }, [hasHydrated, isAuthenticated, router]);

  return null;
}

export default RedirectFromRoot;
