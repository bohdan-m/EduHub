import type { BetterAuthOptions } from "better-auth";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { jwt } from "better-auth/plugins";
import { Pool } from "pg";
import { validateName } from "@/utils/validation";

export const ROLES = ["student", "teacher"] as const;

// Better Auth checks email format and password length itself; names are free text, so trim and cap them here
function cleanName(name: unknown) {
    const value = typeof name === "string" ? name : "";
    const error = validateName(value);
    if (error) throw new APIError("BAD_REQUEST", { message: error });
    return value.trim();
}
export type Role = (typeof ROLES)[number];

// Public URL of this app: Better Auth's base URL and the issuer/audience the API checks in every JWT
const baseURL = (process.env.BETTER_AUTH_URL ?? "http://localhost:5173").replace(/\/$/, "");

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
export const isGoogleEnabled = Boolean(googleClientId && googleClientSecret);

// Connection details come from the standard PG* env vars; auth tables live in their own schema, apart from the API's tables
export const authPool = new Pool({ options: "-c search_path=auth" });

// Kept apart from the instance so the startup migration can use it without creating Better Auth,
// whose schema check would otherwise run (and complain) before the tables exist on a fresh database
export const authOptions = {
    baseURL,
    database: authPool,
    emailAndPassword: {
        enabled: true,
        minPasswordLength: 8,
        maxPasswordLength: 128,
    },
    socialProviders: isGoogleEnabled
        ? { google: { clientId: googleClientId!, clientSecret: googleClientSecret! } }
        : {},
    user: {
        additionalFields: {
            // chosen once at sign-up (Google sign-ups become students); the update hook below locks it
            role: { type: [...ROLES], required: false, defaultValue: "student", input: true },
        },
    },
    databaseHooks: {
        user: {
            create: {
                before: async (user) => {
                    const role = user.role ?? "student";
                    if (!ROLES.includes(role as Role)) {
                        throw new APIError("BAD_REQUEST", { message: "Role must be student or teacher." });
                    }
                    return { data: { ...user, role, name: cleanName(user.name) } };
                },
            },
            update: {
                // input: true would also let /update-user set the role, i.e. a student could make themselves a teacher
                before: async (data) => {
                    if (data.role !== undefined) {
                        throw new APIError("FORBIDDEN", { message: "Role can't be changed." });
                    }
                    if (data.name !== undefined) {
                        return { data: { ...data, name: cleanName(data.name) } };
                    }
                },
            },
        },
    },
    plugins: [
        jwt({
            jwt: {
                issuer: baseURL,
                audience: baseURL,
                expirationTime: "15m",
                definePayload: ({ user }) => ({ email: user.email, name: user.name, role: user.role }),
            },
        }),
        nextCookies(), // must stay last: lets server actions set the session cookie
    ],
} satisfies BetterAuthOptions;
