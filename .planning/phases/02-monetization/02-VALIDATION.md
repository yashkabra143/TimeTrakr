---
phase: 2
slug: monetization
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-28
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None configured (no jest/vitest/pytest in project) |
| **Config file** | none — project has no test runner |
| **Quick run command** | `npm run check` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~5 seconds |

**Note:** The only automated gate per task commit and wave merge is `npm run check` (TypeScript type checking). All behavioral verification is manual.

---

## Sampling Rate

- **After every task commit:** Run `npm run check`
- **After every plan wave:** Run `npm run check` + manual verification per wave
- **Before `/gsd:verify-work`:** Full manual verification checklist below
- **Max feedback latency:** ~5 seconds (TypeScript check)

---

## Per-Task Verification Map

| Behavior | Test Type | Automated Command | Notes |
|----------|-----------|-------------------|-------|
| `planType`/`planExpiresAt`/`razorpaySubId` fields in schema | Automated | `npm run check` | TypeScript will catch missing types |
| `requirePro` middleware returns 403 for free user | Manual | curl/Postman: `curl -X GET /api/tax/gst -H "cookie: ..."` expect 403 | |
| `requirePro` allows Pro user through | Manual | Same endpoint with Pro session | |
| Webhook signature verification rejects invalid sig | Manual | POST `/api/webhooks/razorpay` with wrong secret, expect 400 | |
| Razorpay subscription created without errors | Manual | Razorpay test mode dashboard | |
| /billing page renders for free + pro users | Manual | Browser visual verification | |
| Upgrade modal appears on Pro feature click | Manual | Click locked feature as free user | |
| /tax page shows blurred GST/TDS for free user | Manual | Browser visual verification | |
| PDF download generates and downloads | Manual | Click export button, verify download | |
| In-app cancel button cancels Razorpay subscription | Manual | Test mode subscription + cancel | |
| Post-payment redirect to /billing with toast | Manual | Complete test payment flow | |

---

## Wave 0 Requirements

- [ ] Razorpay plans created in dashboard (Pro Monthly ₹349/mo, Pro Annual ₹2,999/yr)
- [ ] `.env` updated with `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RAZORPAY_PLAN_MONTHLY_ID`, `RAZORPAY_PLAN_ANNUAL_ID`

*Existing TypeScript infrastructure (`npm run check`) covers all automated validation needs.*

---

## Manual-Only Verifications

| Behavior | Why Manual | Test Instructions |
|----------|------------|-------------------|
| Razorpay Checkout UI appears | No browser test runner | Open /billing as free user, click upgrade, verify Razorpay modal opens |
| Payment captured → Pro activated | Requires test Razorpay transaction | Use Razorpay test card, complete payment, verify planType=pro_monthly in DB |
| Webhook idempotency | Requires duplicate webhook replay | Send same webhook event twice, verify no duplicate DB writes |
| PDF export visual quality | Subjective/visual | Download PDF, verify all sections present (gross, TDS, GST, net) |
| Pro access ends at period end | Requires time manipulation | Set planExpiresAt to past, verify requirePro rejects |

---

## Validation Sign-Off

- [ ] All tasks have TypeScript check as automated verify
- [ ] Wave 0 env/dashboard setup complete before any subscription code
- [ ] Manual verification steps tested in Razorpay test mode
- [ ] No watch-mode flags
- [ ] `nyquist_compliant: true` set in frontmatter when all manual steps pass

**Approval:** pending
