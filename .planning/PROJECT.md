# TimeTrakr

## What This Is

TimeTrakr is an earnings tracker built specifically for Indian freelancers who earn in USD. It handles live USD/INR conversion, TDS, GST, and Advance Tax calculations — all in one place. No competitor combines all of these for Indian freelancers.

## Core Value

Every Indian freelancer who earns in dollars should know exactly what they're worth in rupees — after tax, after fees, in real time.

## Requirements

### Validated

- ✓ Multi-user signups with data isolation — Phase 0
- ✓ OAuth (Google + GitHub) + local auth — Phase 0
- ✓ Advance Tax Scheduler (quarterly due dates, email reminders) — Phase 1
- ✓ GST Liability Tracker (18% GST toggle, quarterly liability) — Phase 1
- ✓ TDS Tracker (Section 194J, 10%, Form 26AS reconciliation) — Phase 1

### Active

- [ ] Razorpay integration for Indian users (UPI, cards, net banking, INR billing)
- [ ] Stripe integration for international users (USD billing)
- [ ] Feature gating: Free vs Pro tier
- [ ] Subscription management (upgrade/downgrade, webhooks)
- [ ] FX Rate Advisor (rate history, threshold alerts, withdrawal fee comparison)

### Out of Scope

- Mobile app — PWA is Phase 6 (V2)
- Upwork API direct sync — CSV import works without API; direct sync is V2
- Fiverr/Toggl/Clockify integrations — Phase 6
- Bank statement import — Phase 6
- CA-ready PDF export — deferred after Phase 2 paywall (Pro feature to build in Phase 2)

## Context

- Target: Indian freelancers on Upwork (~1.6M users). Market: 15M Indian freelancers, 24% CAGR.
- Revenue target: ₹2.8 crore ARR at 8,000 paying users (0.5% of Upwork India)
- Pricing: Free (₹0), Pro Monthly (₹349/mo), Pro Annual (₹2,999/yr, ~28% savings)
- Stack: React 19 + Express + PostgreSQL (Neon) + Drizzle ORM + Vercel serverless
- Auth: Passport.js with local + Google + GitHub OAuth; sessions in PostgreSQL
- Deployment: Vercel serverless; Neon HTTP driver required (no persistent TCP)

## Constraints

- **Tech stack**: Vercel serverless — no persistent connections, use HTTP drivers
- **Database**: Neon PostgreSQL with Drizzle ORM — all schema changes via `db:push`
- **Payments**: Must support Indian payment methods (UPI, net banking) → Razorpay required
- **Currency**: INR billing for Indian users; USD optional for international

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| PostgreSQL sessions (connect-pg-simple) | Survive Vercel restarts; no Redis needed | ✓ Good |
| Drizzle ORM + Neon HTTP | Serverless-compatible; type-safe queries | ✓ Good |
| Minutes as canonical time unit | H.MM format ambiguity (8.20 ≠ 8.2h) needed resolution | ✓ Good |
| Earnings snapshots at creation | Changing deduction settings doesn't retroactively alter history | ✓ Good |
| Wouter over React Router | Lightweight; SPA routing needs are simple | ✓ Good |

---
*Last updated: 2026-03-28 after Phase 1 completion*
