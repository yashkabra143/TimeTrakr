# Phase 2: Monetization Layer — Discussion Log

**Date:** 2026-03-28
**For human reference only** — not consumed by downstream agents.

---

## Area 1: Payment Provider Rollout

**Q: Razorpay and Stripe simultaneously or Razorpay first?**
→ Razorpay first. Stripe deferred until international users materialize.

**Q: INR only or USD fallback?**
→ INR only. ₹349/mo and ₹2,999/yr as defined in the launch plan.

**Q: Razorpay Subscriptions (auto-recurring) or one-time orders?**
→ Razorpay Subscriptions. Auto-recurring billing with webhook-driven state management.

**Q: Razorpay account status?**
→ Account and API keys already exist. No setup step needed.

---

## Area 2: Feature Gating Strategy

**Q: Server-side only, client-side only, or both?**
→ Both. API returns 403 for Pro endpoints; UI shows lock icons and upgrade modal.

**Q: Data limits on Free tier?**
→ No data limits. Feature-based gating only — unlimited entries and projects on Free.

**Q: Which features are Pro-only?**
→ All four selected: Tax alerts + GST tracker, TDS reconciliation, CSV import, PDF export.

**Q: Paywall UX — modal, redirect, or lock icon?**
→ Upgrade modal overlay. Shown in-context when Free user clicks a Pro feature.

**Q: /tax page — fully hidden or visible-but-locked for Free?**
→ Visible-but-locked. GST and TDS sections are blurred/locked so users see what they're missing.

---

## Area 3: Subscription UX Flow

**Q: /billing page, settings section, or modal only?**
→ Dedicated /billing page. Accessible from profile/settings nav.

**Q: After payment — redirect to /billing, dashboard, or onboarding screen?**
→ Redirect to /billing with success toast ("Pro activated!").

**Q: In-app cancel or Razorpay customer portal?**
→ In-app cancel. Button on /billing calls our API → Razorpay API.

**Q: Cancel = immediate or end of billing period?**
→ End of billing period. User keeps Pro access until planExpiresAt.

---

## Area 4: Subscription Data Model

**Q: Fields on users table or separate subscriptions table?**
→ Fields on users table: planType (text, default 'free'), planExpiresAt (timestamp nullable), razorpaySubId (text nullable).

**Q: Free trial period?**
→ No trial. New signups are Free until they upgrade.

**Q: Log webhook events?**
→ Yes — webhookEvents table with raw payload, event type, processed status.

**Q: requirePro middleware — session check or DB query per request?**
→ Session check (req.user.planType + planExpiresAt). No extra DB query per request.
