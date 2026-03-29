---
phase: 02-monetization
plan: "02"
subsystem: backend/subscriptions
tags: [razorpay, subscriptions, webhooks, billing]
dependency_graph:
  requires: ["02-01"]
  provides: ["subscription-routes", "webhook-handler", "getUserByRazorpaySubId"]
  affects: ["server/routes.ts", "server/storage.ts"]
tech_stack:
  added: ["razorpay SDK"]
  patterns: ["HMAC-SHA256 webhook verification", "idempotent webhook processing", "session refresh after plan change"]
key_files:
  created:
    - server/subscription-routes.ts
  modified:
    - server/routes.ts
    - server/storage.ts
decisions:
  - "cancel_at_cycle_end: 1 used on cancel — access continues until billing period ends per D-13"
  - "Webhook idempotency key is subId_eventType; duplicate events return 200 silently per D-16"
  - "subscription.cancelled webhook takes no action — planExpiresAt already set from last subscription.charged"
  - "getUserByRazorpaySubId added to storage to keep webhook handler from importing DB directly"
metrics:
  duration: "8m"
  completed_date: "2026-03-29"
  tasks: 2
  files: 3
---

# Phase 02 Plan 02: Razorpay Subscription API Routes Summary

**One-liner:** Server-side Razorpay subscription endpoints (create, verify, cancel, webhook, status) with HMAC signature verification, idempotent webhook processing, and session refresh after plan changes.

## What Was Built

`server/subscription-routes.ts` exports `registerSubscriptionRoutes(app)` which registers five endpoints:

| Endpoint | Auth | Purpose |
|----------|------|---------|
| POST /api/subscriptions/create | requireAuth | Accepts `{ planType: 'monthly' \| 'annual' }`, resolves Razorpay plan ID server-side, returns `subscriptionId` |
| POST /api/subscriptions/verify | requireAuth | Validates HMAC-SHA256 signature, fetches subscription to determine planType and expiry, activates Pro, refreshes session |
| POST /api/subscriptions/cancel | requireAuth | Cancels at cycle end (`cancel_at_cycle_end: 1`), no immediate plan downgrade |
| POST /api/webhooks/razorpay | none | Verifies rawBody HMAC, idempotency check, handles charged/cancelled/halted events |
| GET /api/subscriptions/status | requireAuth | Returns current planType, planExpiresAt, razorpaySubId from DB |

## Storage Changes

Added `getUserByRazorpaySubId(subId: string): Promise<User | undefined>` to `IStorage` interface and `DatabaseStorage` class in `server/storage.ts`. Used by the webhook handler to look up which user a subscription event belongs to.

## Registration

`server/routes.ts` imports and calls `registerSubscriptionRoutes(app)` before the catch-all handler.

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- `npm run check` passes with no errors in server files (pre-existing framer-motion client errors are out of scope)
- All 5 endpoints exist in subscription-routes.ts
- `registerSubscriptionRoutes` imported and called in routes.ts
- `getUserByRazorpaySubId` in both IStorage interface and DatabaseStorage

## Self-Check: PASSED

- server/subscription-routes.ts: FOUND
- server/routes.ts contains `registerSubscriptionRoutes`: FOUND
- server/storage.ts contains `getUserByRazorpaySubId`: FOUND
- Commit e725e13: FOUND
- Commit c706ad5: FOUND
