/**
 * Migration: Replace Twilio SMS/WhatsApp fields with email reminder toggle.
 * Usage: npm run migrate:reminders
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const sql = neon(process.env.DATABASE_URL);

  // Remove Twilio-era columns (safe to run even if they don't exist)
  await sql`ALTER TABLE users DROP COLUMN IF EXISTS phone_number`;
  console.log("✓ Removed phone_number column");

  await sql`ALTER TABLE users DROP COLUMN IF EXISTS reminder_sms`;
  console.log("✓ Removed reminder_sms column");

  await sql`ALTER TABLE users DROP COLUMN IF EXISTS reminder_whatsapp`;
  console.log("✓ Removed reminder_whatsapp column");

  // Add email reminder toggle
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS reminder_enabled BOOLEAN NOT NULL DEFAULT false`;
  console.log("✓ Added reminder_enabled column");

  console.log("\n✅ Migration complete.");
}

main().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
