import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // self-contained server in .next/standalone for the prod Docker image
  output: "standalone",
  // Docker on Windows/macOS doesn't pass file-change events through bind mounts; compose sets this to poll instead
  watchOptions: process.env.WATCHPACK_POLLING === "true" ? { pollIntervalMs: 1000 } : undefined,
};

export default nextConfig;
