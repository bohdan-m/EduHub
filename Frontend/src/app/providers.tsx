"use client";

import { useRouter } from "next/navigation";
import { RouterProvider } from "@heroui/react";

function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  // lets HeroUI (React Aria) links and buttons navigate client-side
  return <RouterProvider navigate={router.push}>{children}</RouterProvider>;
}

export default Providers;
