import type { BetterAuthOptions } from "better-auth";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { haveIBeenPwned, jwt, twoFactor } from "better-auth/plugins";
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

// When an account is deleted, the API removes its courses, progress, reviews, comments and files. Called before the
// account goes, so a failure stops the deletion instead of leaving data behind.
async function removeApiData(userId: string) {
    const api = (process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");
    const secret = process.env.INTERNAL_API_SECRET;
    if (!secret) throw new APIError("INTERNAL_SERVER_ERROR", { message: "Account deletion isn't set up on this server." });
    const response = await fetch(`${api}/api/internal/users/${encodeURIComponent(userId)}/`, {
        method: "DELETE",
        headers: { "X-Internal-Secret": secret },
        signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
        throw new APIError("INTERNAL_SERVER_ERROR", { message: "Couldn't remove your data right now. Try again later." });
    }
}

const rateLimitScale = Math.max(1, Number(process.env.AUTH_RATE_LIMIT_SCALE) || 1);

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
    user: {
        changeEmail: {
            enabled: true,
            // the current address confirms first; the new one then gets its own verification link
            sendChangeEmailConfirmation: async ({ user, newEmail, url }) => {
                void sendEmail({
                    to: user.email,
                    subject: "Confirm your new EduHub email",
                    text: `Hi ${user.name}, someone (hopefully you) asked to change your EduHub email to ${newEmail}. Open this link within an hour to confirm. If it wasn't you, ignore this email and change your password.`,
                    link: url,
                }).catch((error) => console.error("Could not send the email change confirmation:", error));
            },
        },
        deleteUser: {
            enabled: true,
            deleteTokenExpiresIn: 60 * 60,
            // deleting is permanent, so it is confirmed from the inbox (after the password, for password accounts)
            sendDeleteAccountVerification: async ({ user, url }) => {
                void sendEmail({
                    to: user.email,
                    subject: "Confirm deleting your EduHub account",
                    text: `Hi ${user.name}, open this link within an hour to delete your EduHub account with its courses, progress, reviews and comments. This can't be undone. If you didn't ask for this, ignore this email.`,
                    link: url,
                }).catch((error) => console.error("Could not send the account deletion email:", error));
            },
            beforeDelete: async (user) => removeApiData(user.id),
        },
    },
    // Counted in the database so every server instance shares them. Better Auth keys them by the client address from
    // X-Forwarded-For, so in production the proxy must set it (requests without an address aren't limited).
    // AUTH_RATE_LIMIT_SCALE multiplies every limit; the end-to-end suites raise it, as they sign up many accounts a minute
    rateLimit: {
        enabled: true,
        storage: "database",
        window: 60,
        max: 100 * rateLimitScale,
        customRules: {
            "/sign-in/email": { window: 60, max: 10 * rateLimitScale },
            "/sign-up/email": { window: 60, max: 10 * rateLimitScale },
            "/request-password-reset": { window: 60, max: 5 * rateLimitScale },
            "/send-verification-email": { window: 60, max: 5 * rateLimitScale },
            "/two-factor/verify-totp": { window: 60, max: 10 * rateLimitScale },
            "/two-factor/verify-backup-code": { window: 60, max: 10 * rateLimitScale },
            "/change-password": { window: 60, max: 5 * rateLimitScale },
            "/delete-user": { window: 60, max: 5 * rateLimitScale },
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
        // new passwords found in known data breaches are refused (checked by hash prefix; the password never leaves)
        haveIBeenPwned({
            customPasswordCompromisedMessage: "This password has appeared in a data breach, so it's easy to guess. Choose another one.",
        }),
        nextCookies(), // must stay last: lets server actions set the session cookie
    ],
} satisfies BetterAuthOptions;
