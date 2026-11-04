import { NextResponse, type NextRequest } from "next/server";

// The page's Content Security Policy, with a fresh nonce per request: only scripts carrying it (Next's own, and
// whatever they load, via 'strict-dynamic') can run, so injected markup can't execute script.
// Other security headers are set in next.config.ts.
const apiOrigin = new URL(process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").origin;
const isDev = process.env.NODE_ENV === "development";
// only a site served over https can ask browsers to upgrade plain-http requests (local prod runs on http)
const isHttps = (process.env.BETTER_AUTH_URL ?? "").startsWith("https://");

export function contentSecurityPolicy(nonce: string) {
  return [
    "default-src 'self'",
    // React uses eval in development only, for better error stacks
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // style attributes from the UI library can't carry a nonce; styles can't run code
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${apiOrigin}`, // course covers are served by the API
    "font-src 'self' data:",
    `connect-src 'self' ${apiOrigin}`,
    "frame-src https://www.youtube.com https://www.youtube-nocookie.com", // lesson videos are the only embeds
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(isHttps ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = contentSecurityPolicy(nonce);

  // Next reads the policy from the request to put the nonce on its scripts; the layout reads x-nonce
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

export const config = {
  matcher: [
    // pages only: not the auth API, static files, images or link prefetches
    {
      source: "/((?!api|_next/static|_next/image|favicon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
