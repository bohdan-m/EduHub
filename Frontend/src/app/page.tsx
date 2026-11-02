"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/store/store";

// persist is only attached in the browser (no localStorage on the server), so look it up lazily
const subscribeHydration = (onDone: () => void) => useUserStore.persist.onFinishHydration(onDone);
const hasHydratedNow = () => useUserStore.persist.hasHydrated();

// "/" has no page of its own: send people home if logged in, else to login.
// It waits for the saved session to load from localStorage before deciding.
function RedirectFromRoot() {
  const router = useRouter();
  const hasHydrated = useSyncExternalStore(subscribeHydration, hasHydratedNow, () => false);
  const isAuthenticated = useUserStore((state) => !!state.user?.access);

  useEffect(() => {
    if (hasHydrated) router.replace(isAuthenticated ? "/home" : "/login");
  }, [hasHydrated, isAuthenticated, router]);

  return null;
}

export default RedirectFromRoot;
