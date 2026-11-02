"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { RouterProvider } from "@heroui/react";
import { useUserStore } from "@/store/store";

function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    useUserStore.persist.rehydrate();
  }, []);

  // lets HeroUI (React Aria) links and buttons navigate client-side
  return <RouterProvider navigate={router.push}>{children}</RouterProvider>;
}

export default Providers;
