# Phase 2: Monetization Layer — Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Add payment processing and feature gating so users can subscribe via Razorpay, get charged ₹349/month or ₹2,999/year, and unlock Pro features. A Free user hitting a Pro feature sees a paywall modal. Pro access is enforced on both the server (API 403) and client (lock UI).

**In scope:** Razorpay Subscriptions integration, subscription data model, feature gating (server + client), `/billing` page, upgrade modal, Pro PDF export feature, webhook handling, in-app cancellation.

**Out of scope:** Stripe integration (deferred to a later phase when international users materialize), landing page / onboarding (Phase 4), FX alerts (Phase 3), referral program (Phase 5).

</domain>

<decisions>
## Implementation Decisions

### Payment Provider

- **D-01:** Razorpay only for this phase. Stripe is explicitly deferred — add it when international user demand exists.
- **D-02:** INR billing only — ₹349/month and ₹2,999/year. No USD pricing.
- **D-03:** Use **Razorpay Subscriptions** (auto-recurring) — not one-time orders. Razorpay handles charge cadence, failed-payment retries, and cancellation webhooks.
- **D-04:** Razorpay account and API keys already exist — no account setup step needed.

### Feature Gating

- **D-05:** Enforcement is **both server-side AND client-side**. A `requirePro` middleware returns 403 for Pro-only API endpoints. The UI independently shows lock icons and upgrade modals. Never rely on client-side gating alone.
- **D-06:** Free tier has **no data limits** (unlimited entries, projects). Gating is purely feature-based.
- **D-07:** **Pro-only features** (all four must be gated):
  1. Advance Tax email reminders (currently ungated — must gate)
  2. GST tracker section on `/tax` (currently ungated — must gate)
  3. TDS reconciliation section on `/tax` (currently ungated — must gate)
  4. Upwork CSV import (currently ungated — must gate)
  5. PDF export (CA-ready) — new feature to build in this phase
- **D-08:** Paywall UX = **upgrade modal overlay**. When a Free user clicks a locked feature, show an in-app modal with plan comparison and a CTA to subscribe. Do not redirect away from the current page.
- **D-09:** The `/tax` page is **visible-but-locked** for Free users. GST and TDS sections are visible (blurred or with lock overlay) so users see what they're missing — this drives upgrade intent. Do not fully hide sections.

### Subscription UX Flow

- **D-10:** Primary upgrade UI lives at a dedicated **`/billing` page**. Shows Free vs Pro comparison, current plan status, and upgrade CTA. Accessible from profile/settings nav.
- **D-11:** After successful Razorpay payment → **redirect to `/billing` with a success toast** ("Pro activated!"). User sees updated plan status immediately.
- **D-12:** Cancellation is **in-app** — a "Cancel subscription" button on `/billing` calls our API → Razorpay API. Users never leave the app.
- **D-13:** On cancellation, **Pro access continues until end of the billing period** (month or year). Access is not revoked immediately.

### Subscription Data Model

- **D-14:** Subscription state stored as **fields on the `users` table** (not a separate table):
  - `planType` — `text`, default `'free'`. Values: `'free'`, `'pro_monthly'`, `'pro_annual'`
  - `planExpiresAt` — `timestamp`, nullable. Set to subscription period end; null for Free users.
  - `razorpaySubId` — `text`, nullable. Razorpay subscription ID for managing via API.
- **D-15:** **No free trial period.** New signups are Free until they choose to upgrade.
- **D-16:** Webhook events are **logged to a `webhookEvents` table** (raw payload, event type, processed status). Used for idempotency checks and billing debugging.
- **D-17:** `requirePro` middleware reads **`req.user.planType` and `planExpiresAt` from the session** — no extra DB query per request. Session must be refreshed (re-read from DB) after any plan change.

### Claude's Discretion

- Exact visual design of the upgrade modal (layout, copy, colors) — follow existing Syne/Manrope design system.
- Razorpay Checkout integration approach (embedded iframe vs hosted page) — use whatever Razorpay's Node SDK recommends.
- Webhook endpoint path (`/api/webhooks/razorpay` or similar).
- PDF export library choice for the CA-ready export.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `LAUNCH-PLAN.md` — Pricing tiers (Free/Pro Monthly/Pro Annual), Pro feature list, revenue targets. Section: "Phase 2 — Monetization Layer".
- `.planning/PROJECT.md` — Project constraints, tech stack, validated requirements.
- `.planning/ROADMAP.md` — Phase 2 success criteria.

### Existing Code (Integration Points)
- `shared/schema.ts` — Current `users` table schema. New fields (`planType`, `planExpiresAt`, `razorpaySubId`) added here.
- `server/routes.ts` — All API routes. `requireAuth` middleware pattern to follow for `requirePro`.
- `server/storage.ts` — Database query layer. New subscription queries go here.
- `server/app.ts` — Express session config. Session must include plan fields after plan changes.
- `client/src/App.tsx` — Route definitions. `/billing` route to be added here.
- `client/src/lib/hooks.ts` — React Query hooks. `useCurrentUser()` must expose `planType`.
- `client/src/stores/auth-store.ts` — Zustand auth state. May need plan tier for client-side gating.
- `client/src/pages/tax.tsx` — GST and TDS sections to be gated (visible-but-locked for Free).
- `client/src/components/csv-import-dialog.tsx` — To be gated (Pro only).

No external specs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `requireAuth` middleware (`server/routes.ts:22`) — Direct template for `requirePro` middleware. Same pattern: check `req.user`, return 403 if condition not met.
- `useCurrentUser()` hook (`client/src/lib/hooks.ts:6`) — Extend to include `planType` and `planExpiresAt` fields once schema is updated.
- `ProtectedRoute` component (`client/src/App.tsx:20`) — Pattern for wrapping routes; can extend for Pro-only routes.
- Radix UI Dialog component (`client/src/components/ui/`) — Use for the upgrade modal overlay.
- SendGrid email (`server/email.ts`) — Already configured; use for subscription confirmation / cancellation emails.
- `useToast` / `Toaster` — Already in place for post-payment success toast.

### Established Patterns
- All protected API routes use `requireAuth` middleware then read `req.user.id` for userId isolation.
- Drizzle schema changes → `npm run db:push` to apply.
- React Query mutations follow: `mutationFn` → API call → `onSuccess` invalidate query keys.
- Session contains full user object (set via `req.login()` in Passport). After plan update, must call `req.login()` again or manually update `req.user` to reflect new `planType`.

### Integration Points
- New `/api/subscriptions/*` routes in `server/routes.ts` (or a new `server/subscription-routes.ts` if the file becomes too large).
- New `/billing` page in `client/src/pages/billing.tsx` — add route in `App.tsx`.
- Razorpay webhook endpoint: `/api/webhooks/razorpay` — must be excluded from `requireAuth` (webhooks come from Razorpay servers, not user sessions). Must verify Razorpay webhook signature.
- New `webhookEvents` table in `shared/schema.ts`.

</code_context>

<specifics>
## Specifics

- Razorpay Subscriptions (auto-recurring) — not one-time payment orders.
- The `/tax` page should show blurred/locked GST and TDS sections for Free users — not hidden entirely. The point is to make Free users aware of what they're missing.
- Upgrade modal should appear in-context (not a full-page redirect) when a Free user clicks a Pro-only feature.
- Cancellation: access persists until `planExpiresAt`. After that date, `requirePro` middleware should treat the user as Free.
- `planType` check in `requirePro`: user is Pro if `planType != 'free'` AND (`planExpiresAt` is null OR `planExpiresAt > now()`).

</specifics>
