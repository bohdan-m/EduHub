// Runs once when the Next.js server starts (dev and production), before it serves requests
export async function register() {
    if (process.env.NEXT_RUNTIME !== "nodejs") return;
    const { migrateAuthDatabase } = await import("@/lib/auth-migrate");
    await migrateAuthDatabase();
}
