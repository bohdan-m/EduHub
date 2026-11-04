import type { NextConfig } from "next";

// The API sends its own headers; these cover the pages. The Content Security Policy is per request (it needs a
// fresh nonce), so src/proxy.ts sets it.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
    : []),
];

const nextConfig: NextConfig = {
  reactCompiler: true,
  // self-contained server in .next/standalone for the prod Docker image
  output: "standalone",
  // Docker on Windows/macOS doesn't pass file-change events through bind mounts; compose sets this to poll instead
  watchOptions: process.env.WATCHPACK_POLLING === "true" ? { pollIntervalMs: 1000 } : undefined,
  poweredByHeader: false,
  headers: async () => [{ source: "/:path*", headers: securityHeaders }],
};

export default nextConfig;
