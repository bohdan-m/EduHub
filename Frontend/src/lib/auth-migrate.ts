import { getMigrations } from "better-auth/db/migration";
import { authOptions, authPool } from "@/lib/auth-options";

// Creates or updates Better Auth's tables in the "auth" schema; safe to run on every start
export async function migrateAuthDatabase() {
    await authPool.query("CREATE SCHEMA IF NOT EXISTS auth");
    // Better Auth only adds columns; drop the one left over from the student/teacher roles
    await authPool.query('ALTER TABLE IF EXISTS auth."user" DROP COLUMN IF EXISTS role');
    const { runMigrations } = await getMigrations(authOptions);
    await runMigrations();
}
