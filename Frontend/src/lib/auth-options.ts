import type { BetterAuthOptions } from "better-auth";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { jwt, twoFactor } from "better-auth/plugins";
import { Pool } from "pg";
import { sendEmail } from "@/lib/mailer";
import { validateName } from "@/utils/validation";

// Better Auth checks email format and password length itself; names are free text, so trim and cap them here
function cleanName(name: unknown) {
    const value = typeof name === "string" ? name : "";
    const error = validateName(value);
    if (error) throw new APIError("BAD_REQUEST", { message: error });
    return value.trim();
}

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
    appName: "EduHub",
    baseURL,
    database: authPool,
    emailAndPassword: {
        enabled: true,
        minPasswordLength: 8,
        maxPasswordLength: 128,
        // no session until the address is confirmed; Google addresses arrive already verified
        requireEmailVerification: true,
        resetPasswordTokenExpiresIn: 60 * 60,
        revokeSessionsOnPasswordReset: true, // a reset signs out every device, in case someone else was in
        sendResetPassword: async ({ user, url }) => {
            void sendEmail({
                to: user.email,
                subject: "Reset your EduHub password",
                text: `Hi ${user.name}, open this link within an hour to choose a new password. If you didn't ask for this, ignore this email; your password stays the same.`,
                link: url,
            }).catch((error) => console.error("Could not send the password reset email:", error));
        },
    },
    emailVerification: {
        sendOnSignUp: true,
        sendOnSignIn: true, // a sign-in attempt on an unverified account sends a fresh link
        autoSignInAfterVerification: true,
        expiresIn: 60 * 60,
        sendVerificationEmail: async ({ user, url }) => {
            // not awaited, so response time doesn't reveal whether the address has an account
            void sendEmail({
                to: user.email,
                subject: "Confirm your EduHub email",
                text: `Hi ${user.name}, open this link within an hour to confirm your email address and sign in.`,
                link: url,
            }).catch((error) => console.error("Could not send the verification email:", error));
        },
    },
    socialProviders: isGoogleEnabled
        ? { google: { clientId: googleClientId!, clientSecret: googleClientSecret! } }
        : {},
    databaseHooks: {
        user: {
            create: {
                before: async (user) => ({ data: { ...user, name: cleanName(user.name) } }),
            },
            update: {
                before: async (data) => {
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
                definePayload: ({ user }) => ({ email: user.email, name: user.name }),
            },
        }),
        // optional per account (Settings page): authenticator-app codes plus one-time backup codes
        twoFactor({ issuer: "EduHub" }),
        nextCookies(), // must stay last: lets server actions set the session cookie
    ],
} satisfies BetterAuthOptions;
