import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields, jwtClient } from "better-auth/client/plugins";
import type { auth } from "@/lib/auth";

// Same-origin: talks to /api/auth on this Next.js server
export const authClient = createAuthClient({
    plugins: [inferAdditionalFields<typeof auth>(), jwtClient()],
});
