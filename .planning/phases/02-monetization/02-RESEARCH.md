# Phase 2: Monetization Layer — Research

**Researched:** 2026-03-28
**Domain:** Razorpay Subscriptions, feature gating, PDF export, subscription data model
**Confidence:** HIGH (core Razorpay + schema patterns), MEDIUM (PDF library recommendation), HIGH (architecture)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Razorpay only for this phase. Stripe is explicitly deferred.
- **D-02:** INR billing only — ₹349/month and ₹2,999/year. No USD pricing.
- **D-03:** Use Razorpay Subscriptions (auto-recurring) — not one-time orders.
- **D-04:** Razorpay account and API keys already exist — no account setup step needed.
- **D-05:** Enforcement is both server-side AND client-side. A `requirePro` middleware returns 403. The UI shows lock icons and upgrade modals. Never client-side gating alone.
- **D-06:** Free tier has no data limits. Gating is purely feature-based.
- **D-07:** Pro-only features: (1) Advance Tax email reminders, (2) GST tracker section on /tax, (3) TDS reconciliation section on /tax, (4) Upwork CSV import, (5) PDF export (CA-ready) — new feature to build.
- **D-08:** Paywall UX = upgrade modal overlay. Show in-app modal, do not redirect away.
- **D-09:** The /tax page is visible-but-locked for Free users. GST and TDS sections blurred or with lock overlay — do not fully hide.
- **D-10:** Primary upgrade UI lives at a dedicated `/billing` page.
- **D-11:** After successful Razorpay payment → redirect to `/billing` with a success toast.
- **D-12:** Cancellation is in-app — calls our API → Razorpay API. Users never leave the app.
- **D-13:** On cancellation, Pro access continues until end of billing period. Not immediately revoked.
- **D-14:** Subscription state as fields on `users` table: `planType` (text, default `'free'`), `planExpiresAt` (timestamp, nullable), `razorpaySubId` (text, nullable).
- **D-15:** No free trial period.
- **D-16:** Webhook events logged to a `webhookEvents` table (raw payload, event type, processed status).
- **D-17:** `requirePro` reads `req.user.planType` and `planExpiresAt` from session — no extra DB query per request. Session refreshed after any plan change.

### Claude's Discretion

- Exact visual design of the upgrade modal (layout, copy, colors) — follow existing Syne/Manrope design system.
- Razorpay Checkout integration approach (embedded iframe vs hosted page) — use whatever Razorpay's Node SDK recommends.
- Webhook endpoint path (`/api/webhooks/razorpay` or similar).
- PDF export library choice for the CA-ready export.

### Deferred Ideas (OUT OF SCOPE)

- Stripe integration (deferred to a later phase when international users materialize)
- Landing page / onboarding (Phase 4)
- FX alerts (Phase 3)
- Referral program (Phase 5)
</user_constraints>

---

## Summary

Phase 2 adds a complete subscription monetization layer to TimeTrakr. The three pillars are: (1) Razorpay Subscriptions integration for INR recurring billing via UPI/card/net banking; (2) feature gating with a `requirePro` Express middleware and client-side lock UI; and (3) five Pro features (four to gate, one to build as PDF export).

The existing codebase provides strong foundations. The `requireAuth` middleware pattern in `server/routes.ts:22` is the direct template for `requirePro`. The session structure in `server/app.ts` needs `planType`, `planExpiresAt` added to the `SessionData` interface. The Radix UI `Dialog` component is already installed and used in `csv-import-dialog.tsx` — reuse it for the upgrade modal. `@react-pdf/renderer` 4.3.2 is the right choice for the CA-ready PDF export: it works entirely client-side, is serverless-safe, supports React 19, and produces structured documents without a headless browser.

**Primary recommendation:** Install `razorpay` (2.9.6) and `@react-pdf/renderer` (4.3.2). Create two Razorpay plans in the dashboard (monthly ₹349, annual ₹2,999) before coding. Gate features with a single `requirePro` middleware and a single `<ProGate>` React component that either renders children or shows the upgrade modal.

---

## Project Constraints (from CLAUDE.md)

All directives the planner must verify compliance with:

| Directive | Requirement |
|-----------|-------------|
| Database driver | Use Neon HTTP driver (`@neondatabase/serverless`) — no persistent TCP. All schema changes via `npm run db:push`. |
| ORM | Drizzle ORM only. All new tables defined in `shared/schema.ts`. |
| Deployment | Vercel serverless — no long-running processes, no filesystem writes. |
| Session | `express-session` with `connect-pg-simple`. After plan changes, update `req.session.user` in the same request. |
| Auth pattern | All protected API routes use `requireAuth` first, then `requirePro`. Never trust client-provided `userId`. |
| Path aliases | `@/` → `client/src/`, `@shared/` → `shared/`, `@server/` → `server/`. |
| TypeScript | `npm run check` must pass. No `any` escapes without justification. |
| Frontend state | React Query for server state, Zustand (`auth-store.ts`) for auth state. |
| Routing | Wouter (not React Router). |
| Webhook raw body | `server/app.ts` already captures `req.rawBody` in `express.json` `verify` callback — use it for Razorpay signature verification. |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| razorpay | 2.9.6 | Razorpay Node.js SDK — create subscriptions, cancel, verify signatures | Official Razorpay SDK; only dependency is `axios ^1.6.8` |
| @react-pdf/renderer | 4.3.2 | Client-side CA-ready PDF generation | Runs in browser (no server roundtrip), React JSX syntax, supports React 19, TypeScript-native |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| crypto (Node built-in) | built-in | Webhook signature verification | Already in routes.ts for password hashing; reuse for HMAC-SHA256 |
| @types/pg | already in devDeps | Type support | Already installed |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @react-pdf/renderer | jspdf | jsPDF is lower-level (imperative API), no JSX syntax, harder to maintain structured CA reports. @react-pdf/renderer wins for structured documents. |
| @react-pdf/renderer | pdfmake | pdfmake is server-side Node.js focused; steeper JSON-based API; no JSX. |
| Client-side PDF | Puppeteer server-side | Puppeteer requires persistent process — incompatible with Vercel serverless. |

**Installation:**
```bash
npm install razorpay @react-pdf/renderer
```

**Version verification (confirmed 2026-03-28):**
- `razorpay`: 2.9.6 (latest)
- `@react-pdf/renderer`: 4.3.2 (latest, peer deps: React ^16.8 || ^17 || ^18 || ^19 — compatible)

---

## Architecture Patterns

### Recommended Project Structure additions

```
server/
├── subscription-routes.ts   # New: /api/subscriptions/*, /api/webhooks/razorpay
shared/
├── schema.ts                # Extend: add planType/planExpiresAt/razorpaySubId to users; add webhookEvents table
client/src/
├── pages/
│   └── billing.tsx          # New: /billing page — plan comparison, upgrade CTA, cancellation
├── components/
│   ├── pro-gate.tsx         # New: wraps Pro features with paywall logic
│   ├── upgrade-modal.tsx    # New: Radix Dialog upgrade prompt with plan comparison
│   └── pro-lock-overlay.tsx # New: blurred overlay with lock icon for visible-but-locked sections
```

### Pattern 1: requirePro Middleware

**What:** Express middleware that checks if the authenticated user has an active Pro plan. Reads from session — zero DB queries.

**When to use:** All Pro-only API endpoints, applied after `requireAuth`.

**Example:**
```typescript
// Source: D-17 (CONTEXT.md) + requireAuth pattern (server/routes.ts:22)
function requirePro(req: Request, res: Response, next: NextFunction) {
  const user = req.session?.user;
  if (!user) return res.status(401).json({ message: "Unauthorized" });

  const isPro =
    user.planType !== "free" &&
    (user.planExpiresAt === null || new Date(user.planExpiresAt) > new Date());

  if (!isPro) {
    return res.status(403).json({ message: "Pro subscription required" });
  }
  next();
}
```

**Critical:** Session `user` object in `server/app.ts` must be extended to include `planType: string`, `planExpiresAt: string | null`.

### Pattern 2: Session Update After Plan Change

**What:** After any subscription event (activate, cancel), re-read user from DB and update session so subsequent `requirePro` checks are current without a re-login.

**When to use:** Every route that modifies plan state (webhook handler, cancel endpoint).

**Example:**
```typescript
// Source: Established pattern at routes.ts:167 (req.session.user = safeUser)
const updatedUser = await storage.getUserById(userId);
req.session.user = {
  id: updatedUser.id,
  username: updatedUser.username,
  email: updatedUser.email,
  fullName: updatedUser.fullName,
  dateOfBirth: updatedUser.dateOfBirth,
  profilePicture: updatedUser.profilePicture,
  planType: updatedUser.planType,
  planExpiresAt: updatedUser.planExpiresAt?.toISOString() ?? null,
};
```

### Pattern 3: Razorpay Subscription Flow

**What:** 3-step server + client flow to create a subscription and collect payment authorization.

**Step 1 — Create subscription on server (API call from client):**
```typescript
// Source: razorpay-node SDK, document/subscription.md
import Razorpay from "razorpay";
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

// POST /api/subscriptions/create
const subscription = await razorpay.subscriptions.create({
  plan_id: planId,          // "plan_MONTHLY_ID" or "plan_ANNUAL_ID" from env
  total_count: 120,         // 120 billing cycles = 10 years (effectively indefinite)
  quantity: 1,
  customer_notify: 0,       // We handle notification via SendGrid
});
// Return subscription.id to client
```

**Step 2 — Open Razorpay Checkout in browser:**
```typescript
// Source: Razorpay Checkout.js docs; dynamically load script
function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

// Open modal with subscription_id
const options = {
  key: import.meta.env.VITE_RAZORPAY_KEY_ID,
  subscription_id: subscriptionId,    // From server response
  name: "TimeTrakr",
  description: "Pro Monthly — ₹349/mo",
  handler: async (response: {
    razorpay_payment_id: string;
    razorpay_subscription_id: string;
    razorpay_signature: string;
  }) => {
    // POST to /api/subscriptions/verify with response
    await api.verifySubscription(response);
    // Then navigate to /billing?success=1
  },
  prefill: { email: user.email ?? "" },
  theme: { color: "hsl(38,92%,50%)" }, // Match TimeTrakr amber brand color
};
const rzp = new (window as any).Razorpay(options);
rzp.open();
```

**Step 3 — Verify payment on server:**
```typescript
// Source: Razorpay payment verification pattern
// POST /api/subscriptions/verify
const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = req.body;
const isValid = razorpay.validateWebhookSignature(
  razorpay_payment_id + "|" + razorpay_subscription_id,
  razorpay_signature,
  process.env.RAZORPAY_KEY_SECRET!,
);
// Note: For subscription payment verification, the string is `payment_id|subscription_id`
// NOT the webhook body (that uses RAZORPAY_WEBHOOK_SECRET separately)
if (isValid) { /* activate Pro */ }
```

### Pattern 4: Webhook Handler

**What:** Express route that receives Razorpay subscription lifecycle events, verifies signature using raw body, and updates the DB.

**Critical constraint:** Must be excluded from `requireAuth`. Must use `req.rawBody` (already captured by `server/app.ts:45-47`).

```typescript
// Source: WebSearch verified pattern + app.ts rawBody capture
// POST /api/webhooks/razorpay (no requireAuth)
const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET!;
const signature = req.headers["x-razorpay-signature"] as string;
const body = req.rawBody as Buffer;

const expectedSignature = crypto
  .createHmac("sha256", webhookSecret)
  .update(body)
  .digest("hex");

if (expectedSignature !== signature) {
  return res.status(400).json({ message: "Invalid signature" });
}

const event = req.body;
const eventType: string = event.event;
const subEntity = event.payload?.subscription?.entity;

// Idempotency: check webhookEvents table first
// Then switch on eventType
```

**Webhook events to handle:**

| Event | Trigger | Action |
|-------|---------|--------|
| `subscription.charged` | Payment successfully charged | Set `planExpiresAt` = `current_end` (Unix ts); set `planType`; update `razorpaySubId` |
| `subscription.cancelled` | Cancelled (at cycle end or immediately) | Leave `planExpiresAt` as-is; `requirePro` will auto-expire when date passes |
| `subscription.paused` | Subscription paused | No action needed (rare; user-initiated pause not in scope) |
| `subscription.pending` | Payment failed, retrying | Log event; no plan change yet |
| `subscription.halted` | Max retries exhausted | Set `planType = 'free'`; clear `planExpiresAt` and `razorpaySubId` |

**`current_end` field:** Razorpay subscription entity includes `current_end` (Unix timestamp seconds). Use `new Date(subEntity.current_end * 1000)` for `planExpiresAt`.

### Pattern 5: Client-Side ProGate Component

**What:** A React wrapper component that checks the current user's plan and either renders children (Pro user) or shows the upgrade modal / lock overlay.

```typescript
// Recommended pattern — keeps gating DRY
interface ProGateProps {
  children: React.ReactNode;
  mode?: "modal" | "blur";   // "modal": show upgrade dialog; "blur": visible-but-locked overlay
}

function ProGate({ children, mode = "modal" }: ProGateProps) {
  const { data: user } = useCurrentUser();
  const isPro = user?.planType !== "free" && /* expiry check */;
  if (isPro) return <>{children}</>;
  if (mode === "blur") return <ProLockOverlay />;
  return <UpgradeModal trigger={children} />;
}
```

### Pattern 6: Plan IDs — Pre-create in Dashboard

**What:** Razorpay Plans must be created in the Razorpay dashboard (or via API) before the code runs. The plan IDs are then stored as environment variables.

**Action required before coding begins:**
1. Log in to Razorpay dashboard → Subscriptions → Plans
2. Create "TimeTrakr Pro Monthly" plan: interval=1, period=monthly, amount=34900 (paise), currency=INR
3. Create "TimeTrakr Pro Annual" plan: interval=1, period=yearly, amount=299900 (paise), currency=INR
4. Copy plan IDs to `.env`: `RAZORPAY_PLAN_MONTHLY_ID` and `RAZORPAY_PLAN_ANNUAL_ID`

### Anti-Patterns to Avoid

- **Relying on client-side gating alone:** A determined user can bypass JS checks. Always enforce `requirePro` on every Pro API endpoint.
- **Re-reading DB in requirePro:** `requirePro` must NOT query the DB. Read from session. Only re-read DB when session refresh is explicitly needed (post-payment, post-webhook).
- **Parsing req.body in webhook handler:** Razorpay signature verification requires the raw bytes. `req.rawBody` is already captured in `server/app.ts`. Pass it directly to HMAC; do not `JSON.stringify(req.body)` (will break if key order differs).
- **Storing webhook secret same as API key secret:** `RAZORPAY_WEBHOOK_SECRET` and `RAZORPAY_KEY_SECRET` are different secrets. API secret is for SDK calls and payment verification. Webhook secret is set in the Razorpay Dashboard under webhooks.
- **Creating Razorpay plans in code at startup:** Plans are one-time setup in the dashboard. Never create plans in application code — they accumulate and create billing confusion.
- **Blocking all content for Free users on /tax:** D-09 specifies visible-but-locked (blurred overlay), not hidden. Free users must see what they're missing.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Recurring billing | Custom charge scheduler | Razorpay Subscriptions | Handles failed payment retries, dunning, card re-auth, proration — thousands of edge cases |
| Webhook signature verification | Custom crypto check | `razorpay.validateWebhookSignature()` OR `crypto.createHmac` with raw body | Subtle: must use raw body, not parsed JSON. SDK helper or raw crypto both work. |
| PDF generation | Custom HTML→PDF server render | `@react-pdf/renderer` | Puppeteer requires persistent process (incompatible with Vercel serverless); jsPDF has poor table layout |
| Idempotency | Hope webhooks aren't duplicated | `webhookEvents` table with event ID uniqueness check | Razorpay can send the same webhook multiple times; idempotency prevents double-activating Pro |

**Key insight:** Razorpay Subscriptions handles everything that would be catastrophic to get wrong (failed card, insufficient funds retry, bank mandate expiry). Do not replicate this logic.

---

## Common Pitfalls

### Pitfall 1: Webhook Raw Body vs Parsed Body
**What goes wrong:** Using `JSON.stringify(req.body)` for signature verification fails intermittently because key ordering in JSON serialization is not guaranteed to match Razorpay's original payload byte order.
**Why it happens:** `express.json()` parses the body; `JSON.stringify` may reorder keys differently than the original.
**How to avoid:** Use `req.rawBody` (already captured by `server/app.ts:45-47`). Pass the buffer directly to HMAC.
**Warning signs:** Webhook signature errors in production but not in Razorpay's test panel re-send.

### Pitfall 2: Session Not Refreshed After Plan Change
**What goes wrong:** User pays and gets Pro activated in DB, but `requirePro` still returns 403 because the session still has `planType: 'free'` from before the payment.
**Why it happens:** Sessions are not automatically re-read from DB between requests.
**How to avoid:** After every plan state change (payment verification, webhook activation), explicitly update `req.session.user` with new plan fields. The pattern already exists in routes.ts at line 167.
**Warning signs:** User complains "I paid but still see the paywall" immediately after upgrade.

### Pitfall 3: Razorpay Plan IDs Not in Environment
**What goes wrong:** Code tries to reference `process.env.RAZORPAY_PLAN_MONTHLY_ID` at runtime but the plans haven't been created in the dashboard yet.
**Why it happens:** Plans require manual one-time creation in Razorpay dashboard; they're not auto-created by the SDK.
**How to avoid:** Create plans in dashboard first, add IDs to `.env` and Vercel environment variables before deploying. Add Wave 0 task for this.
**Warning signs:** `undefined` plan_id passed to `razorpay.subscriptions.create()` → Razorpay API error 400.

### Pitfall 4: Expired Subscription Not Checked
**What goes wrong:** User cancels, gets charged until month-end (correct), but after `planExpiresAt` passes, they still see Pro features because `requirePro` doesn't check expiry.
**Why it happens:** Forgotten expiry check in middleware.
**How to avoid:** `requirePro` must check BOTH conditions: `planType !== 'free'` AND `(planExpiresAt === null OR planExpiresAt > now())`.
**Warning signs:** Cancelled users still have access after their billing period ends.

### Pitfall 5: VITE_RAZORPAY_KEY_ID Exposed vs Server Key
**What goes wrong:** Razorpay `key_id` (publishable) is safe to expose in the frontend. `key_secret` must NEVER go to the frontend.
**Why it happens:** Confusion between public key and private key.
**How to avoid:** Only `VITE_RAZORPAY_KEY_ID` goes into the Vite bundle. All SDK calls using `key_secret` stay in server code only.
**Warning signs:** `RAZORPAY_KEY_SECRET` appearing in any `client/` or `VITE_` variable.

### Pitfall 6: @react-pdf/renderer SSR on Vercel
**What goes wrong:** `@react-pdf/renderer` may attempt to import browser APIs if used server-side in certain configurations.
**Why it happens:** The library detects environment; Vercel Edge runtime can behave differently.
**How to avoid:** Generate PDF entirely in the browser (client-side). The `/billing` page triggers PDF generation via a button click in the React client. No server-side PDF rendering required.
**Warning signs:** `window is not defined` errors in Vercel function logs.

### Pitfall 7: Webhook Events for Both Monthly and Annual Plans
**What goes wrong:** The `subscription.charged` webhook fires for both monthly and annual subscriptions. The `current_end` field in the payload is per-billing-cycle, not the annual end — for annual plans, `current_end` IS the year anniversary, which is correct. But if plan type determination relies only on amount, it can misclassify.
**Why it happens:** Not using plan_id to distinguish plan type.
**How to avoid:** Read `subEntity.plan_id` from the webhook payload and compare against `RAZORPAY_PLAN_MONTHLY_ID` / `RAZORPAY_PLAN_ANNUAL_ID` env vars to set `planType` correctly.

---

## Code Examples

### Schema Extension (shared/schema.ts)

```typescript
// Source: D-14 (CONTEXT.md) + existing schema pattern
export const users = pgTable("users", {
  // ... existing fields ...
  planType: text("plan_type").notNull().default("free"),
  planExpiresAt: timestamp("plan_expires_at"),        // nullable
  razorpaySubId: text("razorpay_sub_id"),             // nullable
});

export const webhookEvents = pgTable("webhook_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: text("event_id").notNull().unique(),       // x-razorpay-event-id header
  eventType: text("event_type").notNull(),
  payload: text("payload").notNull(),                 // raw JSON string
  processed: boolean("processed").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

### SessionData Extension (server/app.ts)

```typescript
// Source: Existing pattern at server/app.ts:10
declare module "express-session" {
  interface SessionData {
    userId: string;
    user: {
      id: string;
      username: string;
      email?: string | null;
      fullName?: string | null;
      dateOfBirth?: string | null;
      profilePicture?: string | null;
      planType: string;                  // ADD
      planExpiresAt: string | null;      // ADD (ISO string)
    };
  }
}
```

### Cancel Subscription (server-side)

```typescript
// Source: razorpay-node SDK docs (subscriptions.cancel)
// POST /api/subscriptions/cancel
await razorpay.subscriptions.cancel(user.razorpaySubId!, {
  cancel_at_cycle_end: 1,  // 1 = cancel at period end (access continues until planExpiresAt)
});
// Do NOT update planType or planExpiresAt here — the subscription.cancelled
// webhook will fire, and the expiry is already set from subscription.charged.
```

### Dynamic Razorpay Script Loading (React)

```typescript
// Source: WebSearch pattern (multiple community sources agree)
async function loadRazorpayScript(): Promise<boolean> {
  if ((window as any).Razorpay) return true;
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}
```

### @react-pdf/renderer CA-Ready Report Skeleton

```typescript
// Source: @react-pdf/renderer 4.3.2 official docs
import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 32, fontFamily: "Helvetica" },
  title: { fontSize: 18, fontWeight: "bold", marginBottom: 8 },
  table: { display: "flex", flexDirection: "column" },
  row: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#eee", padding: 4 },
  cell: { flex: 1, fontSize: 10 },
});

function TaxReport({ data }: { data: TaxReportData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Tax Summary — {data.fy}</Text>
        {/* ... tables for TDS, GST, Advance Tax ... */}
      </Page>
    </Document>
  );
}

// Generate and download
async function downloadPDF(data: TaxReportData) {
  const blob = await pdf(<TaxReport data={data} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `timetrakr-tax-report-${data.fy}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Razorpay Orders (one-time) | Razorpay Subscriptions (auto-recurring) | N/A — always separate | Subscriptions handle retries, mandate re-auth, cadence automatically |
| Server-side PDF (Puppeteer) | Client-side PDF (@react-pdf/renderer) | Vercel serverless era | No server process needed; zero cold-start issues |
| Hidden Pro features | Visible-but-locked (blur + overlay) | Industry UX best practice | Drives upgrade intent — users see value before paying |

**Deprecated/outdated:**
- Razorpay Checkout v1 (modal-based) is still the correct approach for subscriptions as of 2026. The hosted payment pages alternative exists but modal gives better in-app UX.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Backend runtime | Yes | v22.18.0 | — |
| npm | Package manager | Yes | 11.11.0 | — |
| razorpay npm pkg | Subscription API calls | Not yet installed | — | `npm install razorpay` |
| @react-pdf/renderer | PDF export | Not yet installed | — | `npm install @react-pdf/renderer` |
| RAZORPAY_KEY_ID | Razorpay API auth | Not in .env yet | — | Must be added (D-04: account exists) |
| RAZORPAY_KEY_SECRET | Razorpay API auth | Not in .env yet | — | Must be added (D-04: account exists) |
| RAZORPAY_WEBHOOK_SECRET | Webhook verification | Not in .env yet | — | Must be configured in Razorpay dashboard |
| RAZORPAY_PLAN_MONTHLY_ID | Create monthly subscriptions | Not in .env yet | — | Must create plan in Razorpay dashboard |
| RAZORPAY_PLAN_ANNUAL_ID | Create annual subscriptions | Not in .env yet | — | Must create plan in Razorpay dashboard |
| VITE_RAZORPAY_KEY_ID | Frontend checkout | Not in .env yet | — | Same value as RAZORPAY_KEY_ID (safe to expose) |
| Neon PostgreSQL | Database | Yes (existing) | — | — |
| SendGrid | Subscription emails | Yes (existing) | — | — |

**Missing dependencies with no fallback:**
- Razorpay environment variables (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET): must be obtained from the existing Razorpay account and added to `.env` and Vercel project settings.
- Razorpay Plan IDs: require one-time manual creation in the Razorpay dashboard before any code can run subscription flows.

**Missing dependencies with fallback:**
- `razorpay` npm package: not installed, but trivially installable. Plan installs Wave 0.
- `@react-pdf/renderer` npm package: not installed, Wave 0 install task.

---

## Validation Architecture

No `.planning/config.json` found — treating `nyquist_validation` as enabled (default).

No test framework is configured in this project (`npm run check` only runs TypeScript type checking). There are no test files, no `jest.config.*`, no `vitest.config.*`, no `pytest.ini`. The project has **no automated test infrastructure**.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None configured |
| Config file | None |
| Quick run command | `npm run check` (TypeScript type check only) |
| Full suite command | `npm run check` |

### Phase Requirements → Test Map

| Behavior | Test Type | Automated Command | Notes |
|----------|-----------|-------------------|-------|
| `requirePro` returns 403 for free user | Manual API test | — | No test runner; verify with curl/Postman |
| `requirePro` allows Pro user through | Manual API test | — | Same |
| Schema migration adds planType/planExpiresAt fields | Manual DB check | `npm run db:push` then inspect | |
| Webhook signature verification rejects invalid signature | Manual API test | — | POST with wrong signature, expect 400 |
| TypeScript types for new schema fields | Automated | `npm run check` | Will catch missing type declarations |
| Razorpay subscription created without errors | Manual integration test | — | Test mode in Razorpay dashboard |
| /billing page renders | Manual browser test | — | Visual verification |
| PDF download works | Manual browser test | — | Click export button, verify download |

### Wave 0 Gaps
- No automated test infrastructure to create for this phase — project has no test runner.
- TypeScript check (`npm run check`) is the only automated validation tool available.

*(The only automated gate per task commit and wave merge: `npm run check` must pass.)*

---

## Open Questions

1. **Razorpay Plan IDs — who creates them?**
   - What we know: Plans must exist in the Razorpay dashboard before code runs. The account already exists (D-04).
   - What's unclear: Whether the plans have already been created or if the implementer must create them.
   - Recommendation: Wave 0 task — "Create TimeTrakr Pro Monthly and Pro Annual plans in Razorpay dashboard and add plan IDs to .env". Block all subscription coding on this.

2. **Webhook secret rotation / Vercel env vars**
   - What we know: Webhook secret is set in Razorpay dashboard → Webhooks settings. A new secret must be generated and added to Vercel.
   - What's unclear: Whether the Vercel project already has Razorpay env vars set.
   - Recommendation: Wave 0 task — verify Vercel project has all 6 required Razorpay env vars set before deploying webhook endpoint.

3. **Tax Reminders gating: email already sent vs gating the toggle**
   - What we know: D-07 says advance tax email reminders must be gated. Currently `reminderEnabled` is a boolean on the users table; the cron job sends reminders for all users with `reminderEnabled = true`.
   - What's unclear: Should the cron job skip Free users even if they somehow have `reminderEnabled = true`? Or is gating purely at the "enable reminders" toggle in the UI?
   - Recommendation: Gate both: (1) the UI toggle (show upgrade modal for Free users clicking "Enable reminders"), and (2) the cron job should skip users who are not Pro (`planType = 'free'` or expired). This prevents any edge cases.

4. **annual planType value — 'pro_annual' or 'pro_yearly'**
   - What we know: D-14 specifies values `'free'`, `'pro_monthly'`, `'pro_annual'`.
   - What's unclear: No clarification needed — follow D-14 exactly.
   - Recommendation: Use `'pro_annual'` as specified.

---

## Sources

### Primary (HIGH confidence)
- Razorpay Node SDK GitHub (`razorpay-node/documents/subscription.md`) — subscription create, cancel, fetch, payment verification method signatures
- Razorpay SDK source (`razorpay-node/lib/utils/razorpay-utils.js`) — `validateWebhookSignature(body, signature, secret)` function signature
- `server/app.ts` (codebase) — `req.rawBody` capture pattern, session structure
- `server/routes.ts` (codebase) — `requireAuth` pattern, `safeUser` session update pattern, route registration
- `shared/schema.ts` (codebase) — Drizzle table definition patterns
- `client/src/components/csv-import-dialog.tsx` (codebase) — Dialog component usage, design system patterns
- npm registry — `razorpay@2.9.6`, `@react-pdf/renderer@4.3.2` (verified 2026-03-28)

### Secondary (MEDIUM confidence)
- [Razorpay WooCommerce Subscriptions webhook PHP](https://github.com/razorpay/razorpay-woocommerce-subscriptions/blob/master/includes/razorpay-subscription-webhook.php) — confirmed event names: `subscription.charged`, `subscription.cancelled`, `subscription.paused`, `subscription.resumed`, `subscription.failed`; `current_end` field usage
- [Integrate Razorpay Subscription in React.js and Node.js — Medium](https://abhishek-gupta.medium.com/integrate-razorpay-subscription-in-react-js-and-node-js-9109e33bae1a) — checkout options object with `subscription_id`, handler callback shape
- WebSearch results confirming: webhook header is `x-razorpay-signature`, HMAC-SHA256, raw body required

### Tertiary (LOW confidence — verify before implementing)
- [Razorpay Subscriptions Webhook Events docs](https://razorpay.com/docs/webhooks/payloads/subscriptions/) — Navigation confirmed page exists but content not extractable through WebFetch. Payload fields (`current_end`, `plan_id`) inferred from PHP SDK source.
- `subscription.halted` event (payment retries exhausted) — mentioned in WebSearch results but not verified in official docs. Include handler defensively.

---

## Metadata

**Confidence breakdown:**
- Standard stack (razorpay, @react-pdf/renderer): HIGH — verified npm versions, peer deps, and official SDK method signatures
- Architecture patterns (requirePro, session update, webhook handler): HIGH — directly derived from existing codebase patterns
- Webhook event names and payload fields: MEDIUM — confirmed from PHP SDK source and WebSearch; official docs page not extractable
- PDF library choice (@react-pdf/renderer): MEDIUM — serverless compatibility inferred from "runs in browser" claim; Puppeteer incompatibility with Vercel is HIGH confidence

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (30-day estimate; Razorpay API is stable)
