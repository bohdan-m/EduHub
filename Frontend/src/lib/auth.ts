import { betterAuth } from "better-auth";
import { authOptions } from "@/lib/auth-options";

export { isGoogleEnabled, ROLES, type Role } from "@/lib/auth-options";

export const auth = betterAuth(authOptions);
