/**
 * Migration: Assign admin user's ID to all existing rows with null userId.
 * Run once after deploying the multi-user schema changes.
 * Usage: npm run migrate:user-ids
 */

import "dotenv/config";
import { neon } from "@neondatabase/serverless";

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  const sql = neon(process.env.DATABASE_URL);

  // 1. Find the admin user (first user created, or username = 'admin')
  const users = await sql`SELECT id, username FROM users ORDER BY created_at ASC LIMIT 5`;
  console.log("Found users:", users.map((u: any) => `${u.username} (${u.id})`).join(", "));

  if (users.length === 0) {
    console.log("No users found — nothing to migrate.");
    return;
  }

  // Prefer user named "admin", otherwise take the oldest user
  const adminUser = users.find((u: any) => u.username === "admin") ?? users[0];
  const userId = adminUser.id;
  console.log(`\nAssigning userId = ${userId} (${adminUser.username}) to all null-userId rows...\n`);

  // 2. Update each table
  const tables = [
    "projects",
    "time_entries",
    "deductions",
    "currency_settings",
    '"Withdrawl"', // note: original typo in table name
  ] as const;

  for (const table of tables) {
    const result = await sql.unsafe(
      `UPDATE ${table} SET user_id = $1 WHERE user_id IS NULL`,
      [userId]
    );
    // neon returns rowCount in the result
    const count = (result as any).rowCount ?? "?";
    console.log(`  ${table}: updated ${count} rows`);
  }

  console.log("\nMigration complete.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
