/**
 * One-time migration: Merge orphaned OAuth user back into original admin account.
 *
 * Problem: Admin signed in via Google before the email/googleId was set on their
 * account. findOrCreateOAuthUser created a NEW user instead of linking.
 * This script merges that new user's identity back into the original admin and
 * reassigns all data.
 *
 * Usage: npm run fix:identity
 */

import "dotenv/config";
import { neon } from "@neondatabase/serverless";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

  const sql = neon(process.env.DATABASE_URL);

  // ── 1. Show current users ─────────────────────────────────────────────────
  const allUsers = await sql`
    SELECT id, username, email, google_id, github_id, full_name, profile_picture, created_at
    FROM users
    ORDER BY created_at ASC
  `;

  console.log("\nCurrent users in DB:");
  allUsers.forEach((u: any) => {
    console.log(`  [${u.username}] id=${u.id} | email=${u.email ?? "null"} | google_id=${u.google_id ?? "null"} | created=${u.created_at}`);
  });

  if (allUsers.length === 0) {
    console.log("No users found — nothing to do.");
    return;
  }

  // ── 2. Find original user (no OAuth IDs, no email — the "admin") ──────────
  const originalUser = allUsers.find(
    (u: any) => !u.google_id && !u.github_id && !u.email
  );

  // ── 3. Find OAuth user (has googleId or githubId) ─────────────────────────
  const oauthUsers = allUsers.filter(
    (u: any) => u.google_id || u.github_id
  );

  if (!originalUser) {
    console.log("\nNo un-linked seed account found (no user with null email + null oauth IDs).");
    console.log("Your accounts may already be correctly linked. Checking null userId rows...");

    // Still fix any null userId rows
    if (allUsers.length >= 1) {
      await fixNullUserIds(sql, allUsers[0].id, allUsers[0].username);
    }
    return;
  }

  if (oauthUsers.length === 0) {
    console.log("\nNo OAuth users found. Fixing any null userId rows only...");
    await fixNullUserIds(sql, originalUser.id, originalUser.username);
    return;
  }

  console.log(`\nOriginal seed account: [${originalUser.username}] id=${originalUser.id}`);
  console.log(`OAuth user(s) to merge: ${oauthUsers.map((u: any) => `[${u.username}]`).join(", ")}`);

  // ── 4. For each OAuth user, merge into original ───────────────────────────
  for (const oauthUser of oauthUsers) {
    console.log(`\n── Merging [${oauthUser.username}] → [${originalUser.username}] ──`);

    // Copy OAuth identity fields to original user
    await sql`
      UPDATE users SET
        google_id   = COALESCE(google_id,  ${oauthUser.google_id}),
        github_id   = COALESCE(github_id,  ${oauthUser.github_id}),
        email       = COALESCE(email,      ${oauthUser.email}),
        full_name   = COALESCE(full_name,  ${oauthUser.full_name ?? null}),
        profile_picture = COALESCE(profile_picture, ${oauthUser.profile_picture ?? null})
      WHERE id = ${originalUser.id}
    `;
    console.log("  ✓ Copied OAuth identity to original user");

    // Reassign all data tables
    const oauthId = oauthUser.id;
    const origId = originalUser.id;
    const reassigns = [
      { name: "projects",          fn: () => sql`UPDATE projects SET user_id = ${origId} WHERE user_id = ${oauthId} RETURNING id` },
      { name: "time_entries",      fn: () => sql`UPDATE time_entries SET user_id = ${origId} WHERE user_id = ${oauthId} RETURNING id` },
      { name: "deductions",        fn: () => sql`UPDATE deductions SET user_id = ${origId} WHERE user_id = ${oauthId} RETURNING id` },
      { name: "currency_settings", fn: () => sql`UPDATE currency_settings SET user_id = ${origId} WHERE user_id = ${oauthId} RETURNING id` },
      { name: "Withdrawl",         fn: () => sql`UPDATE "Withdrawl" SET user_id = ${origId} WHERE user_id = ${oauthId} RETURNING id` },
    ];
    for (const { name, fn } of reassigns) {
      const rows = await fn();
      if (rows.length > 0) console.log(`  ✓ ${name}: reassigned ${rows.length} rows`);
    }

    // Delete the orphan OAuth user
    await sql`DELETE FROM users WHERE id = ${oauthUser.id}`;
    console.log(`  ✓ Deleted orphan user [${oauthUser.username}]`);
  }

  // ── 5. Fix any remaining null userId rows ─────────────────────────────────
  await fixNullUserIds(sql, originalUser.id, originalUser.username);

  // ── 6. Show final state ───────────────────────────────────────────────────
  const finalUsers = await sql`SELECT id, username, email, google_id, github_id FROM users ORDER BY created_at ASC`;
  console.log("\nFinal users in DB:");
  finalUsers.forEach((u: any) => {
    console.log(`  [${u.username}] id=${u.id} | email=${u.email ?? "null"} | google_id=${u.google_id ?? "null"}`);
  });

  console.log("\n✅ Migration complete. Log in via Google — your data should be restored.");
}

async function fixNullUserIds(sql: any, userId: string, username: string) {
  let anyFixed = false;
  const queries = [
    { name: "projects",          fn: () => sql`UPDATE projects SET user_id = ${userId} WHERE user_id IS NULL RETURNING id` },
    { name: "time_entries",      fn: () => sql`UPDATE time_entries SET user_id = ${userId} WHERE user_id IS NULL RETURNING id` },
    { name: "deductions",        fn: () => sql`UPDATE deductions SET user_id = ${userId} WHERE user_id IS NULL RETURNING id` },
    { name: "currency_settings", fn: () => sql`UPDATE currency_settings SET user_id = ${userId} WHERE user_id IS NULL RETURNING id` },
    { name: "Withdrawl",         fn: () => sql`UPDATE "Withdrawl" SET user_id = ${userId} WHERE user_id IS NULL RETURNING id` },
  ];
  for (const { name, fn } of queries) {
    const rows = await fn();
    if (rows.length > 0) {
      console.log(`  ✓ ${name}: fixed ${rows.length} null user_id rows → assigned to [${username}]`);
      anyFixed = true;
    }
  }
  if (!anyFixed) console.log("  No null user_id rows found.");
}

main().catch((err) => {
  console.error("\n❌ Migration failed:", err);
  process.exit(1);
});
