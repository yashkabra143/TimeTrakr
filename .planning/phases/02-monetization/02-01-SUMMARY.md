---
phase: 02-monetization
plan: 01
subsystem: monetization-foundation
tags: [schema, auth, middleware, storage, razorpay]
dependency_graph:
  requires: []
  provides:
    - planType/planExpiresAt/razorpaySubId on users table
    - webhookEvents table with idempotent eventId constraint
    - requirePro middleware for Pro-gating API routes
    - updateUserPlan/getWebhookEvent/createWebhookEvent storage methods
    - planType/planExpiresAt in session and client User type
  affects:
    - server/routes.ts (all session-setting code paths updated)
    - shared/schema.ts (users + new webhookEvents table)
    - server/app.ts (SessionData extended)
    - server/storage.ts (IStorage interface + DatabaseStorage)
    - client/src/lib/auth.ts (User interface)
tech_stack:
  added:
    - razorpay (npm package, payment provider SDK)
    - "@react-pdf/renderer" (npm package, CA-ready PDF export)
  patterns:
    - requirePro reads session only (no DB query on every gated request)
    - safeUser pattern extended to carry plan fields through all auth paths
key_files:
  created:
    - .env.example
  modified:
    - shared/schema.ts
    - server/app.ts
    - server/storage.ts
    - server/routes.ts
    - client/src/lib/auth.ts
    - package.json
    - package-lock.json
decisions:
  - "requirePro reads planType/planExpiresAt from session (not DB) for zero-overhead gating on every request — consistent with the session-first pattern already used by requireAuth"
  - "planExpiresAt stored as ISO string in session (not Date object) because sessions are serialized to JSON; toISOString() called on DB Date before storage"
  - "planType defaults to 'free' in schema so existing users automatically get free tier without a migration"
  - "webhookEvents.eventId has unique constraint for idempotent Razorpay webhook processing"
metrics:
  duration: "4 minutes"
  completed_date: "2026-03-29"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 7
---

# Phase 2 Plan 1: Subscription Foundation Summary

One-liner: Schema + session + middleware foundation for Razorpay Pro subscriptions — planType on users, webhookEvents table, requirePro middleware, and npm packages installed.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Install npm packages and update .env.example | e885bc5 | package.json, package-lock.json, .env.example |
| 2 | Extend schema, session types, storage layer, requirePro middleware | e9f190b | shared/schema.ts, server/app.ts, server/storage.ts, server/routes.ts, client/src/lib/auth.ts |

## What Was Built

### shared/schema.ts
- Added `planType` (text, not null, default "free"), `planExpiresAt` (timestamp, nullable), `razorpaySubId` (text, nullable) to `users` table
- Added new `webhookEvents` table with `eventId` unique constraint for idempotent webhook processing
- Added `insertWebhookEventSchema`, `WebhookEvent`, and `InsertWebhookEvent` exports

### server/app.ts
- Extended `SessionData.user` interface to include `planType: string` and `planExpiresAt: string | null`

### server/storage.ts
- Added `webhookEvents` and `WebhookEvent` imports from schema
- Added `updateUserPlan`, `getWebhookEvent`, `createWebhookEvent` to both `IStorage` interface and `DatabaseStorage` class

### server/routes.ts
- Added `requirePro` middleware after `requireAuth` — checks session, returns 403 with `{ code: "PRO_REQUIRED" }` for non-pro users
- Updated all 5 `req.session.user`/`safeUser` assignment sites: register, login, /api/me, Google OAuth callback, GitHub OAuth callback, and PATCH /api/user

### client/src/lib/auth.ts
- Extended `User` interface with `planType: string` and `planExpiresAt: string | null`

### .env.example
- Created with all existing env vars plus 6 new Razorpay variables documented

## Deviations from Plan

None — plan executed exactly as written.

Note: Pre-existing TypeScript errors in framer-motion components (animated-card.tsx, dashboard-header.tsx, etc.) and routes.ts were confirmed to pre-date this plan via `git stash` verification. These are out-of-scope per deviation rules and logged to deferred-items.

## Known Stubs

None — no UI components were created in this plan. The schema changes require `npm run db:push` to apply to the database before the new columns and table are usable in production.

## Self-Check: PASSED

Files exist:
- .env.example: FOUND
- shared/schema.ts (with planType): FOUND
- server/routes.ts (with requirePro): FOUND
- server/storage.ts (with updateUserPlan): FOUND

Commits exist:
- e885bc5: chore(02-01): install razorpay and @react-pdf/renderer, add .env.example — FOUND
- e9f190b: feat(02-01): add subscription schema, requirePro middleware, and extended session types — FOUND
