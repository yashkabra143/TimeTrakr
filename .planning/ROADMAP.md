# Roadmap: TimeTrakr

## Overview

TimeTrakr is launching as the only earnings tracker built for Indian freelancers. The roadmap progresses from multi-user infrastructure (Phase 0) through tax intelligence (Phase 1), monetization (Phase 2), FX rate advisory (Phase 3), beta launch (Phase 4), growth marketing (Phase 5), and V2 platform integrations (Phase 6).

## Phases

- [x] **Phase 0: Foundation Fix** - Multi-user signups, data isolation, session persistence, per-user settings
- [x] **Phase 1: Tax Intelligence** - Advance Tax Scheduler, GST Liability Tracker, TDS Tracker, email reminders
- [ ] **Phase 2: Monetization Layer** - Razorpay + Stripe integration, feature gating (Free/Pro), subscription management
- [ ] **Phase 3: FX Rate Advisor** - Rate history chart, threshold alerts, withdrawal fee calculator, smart timing hints
- [ ] **Phase 4: Beta Launch** - Landing page, onboarding flow, community outreach, user interviews, legal
- [ ] **Phase 5: Growth & Marketing** - YouTube, LinkedIn, Reddit, Product Hunt, SEO, referral program
- [ ] **Phase 6: Platform Integrations (V2)** - Fiverr CSV, Toggl/Clockify sync, bank statement import, mobile PWA

## Phase Details

### Phase 0: Foundation Fix
**Goal**: Enable multi-user signups — currently single-user only
**Depends on**: Nothing
**Success Criteria** (what must be TRUE):
  1. Two different people can sign up and see only their own data
  2. Sessions survive server restarts
  3. OAuth (Google + GitHub) works alongside local auth
**Plans**: TBD
**Status**: ✅ Complete

### Phase 1: Tax Intelligence
**Goal**: Build the moat — tax features no competitor has
**Depends on**: Phase 0
**Success Criteria** (what must be TRUE):
  1. Freelancer can see exactly what they owe in taxes this quarter
  2. Advance Tax quarterly due dates shown with estimates from YTD earnings
  3. GST liability tracked for registered users (18%, quarterly GSTR-3B)
  4. TDS deductions logged and reconciled against Form 26AS
  5. Email reminders sent 2 weeks before advance tax due dates
**Plans**: TBD
**Status**: ✅ Complete

### Phase 2: Monetization Layer
**Goal**: Start generating revenue — a user can subscribe, get charged ₹349, and unlock Pro features
**Depends on**: Phase 1
**Success Criteria** (what must be TRUE):
  1. User can subscribe via Razorpay (UPI/card/net banking) for ₹349/mo or ₹2,999/yr
  2. Pro features (tax alerts, GST tracker, TDS reconciliation, PDF export, CSV import) are gated
  3. Free tier user hits a paywall when accessing Pro features
  4. Webhook handles payment confirmation and activates Pro access
  5. User can view subscription status and manage billing
**Plans:** 1/6 plans executed

Plans:
- [x] 02-01-PLAN.md — Foundation: schema, middleware, dependencies, session types
- [ ] 02-02-PLAN.md — Server-side Razorpay subscription routes and webhook handler
- [ ] 02-03-PLAN.md — Client-side gating components (ProGate, UpgradeModal, ProLockOverlay) and API hooks
- [ ] 02-04-PLAN.md — Billing page with plan status, upgrade CTA, and cancellation
- [ ] 02-05-PLAN.md — Apply feature gating to tax page, CSV import, email reminders, and cron
- [ ] 02-06-PLAN.md — CA-ready PDF export feature using @react-pdf/renderer

### Phase 3: FX Rate Advisor
**Goal**: Save users real money on withdrawal timing → they tell their friends
**Depends on**: Phase 2
**Success Criteria** (what must be TRUE):
  1. Users can see USD/INR rate history for last 30/90 days on withdrawal page
  2. Users can set a rate threshold alert ("notify me when USD > ₹87")
  3. Users receive email/notification when market hits their target
  4. Withdrawal fee comparison shown (Payoneer vs Wise vs Skydo vs Direct Bank)
  5. Smart timing hint shown ("rate is 2.3% above 30-day avg — good time to withdraw")
**Plans**: TBD

### Phase 4: Beta Launch
**Goal**: 50 active users, 10 paying, 20 interviews done
**Depends on**: Phase 3
**Success Criteria** (what must be TRUE):
  1. Landing page live with clear value prop
  2. Onboarding flow guides new users to first entry
  3. 50 active users signed up
  4. 10 paying subscribers
  5. 20 user interviews completed
  6. Privacy Policy + Terms of Service + tax disclaimer live
**Plans**: TBD

### Phase 5: Growth & Marketing
**Goal**: 100 → 2,000 users
**Depends on**: Phase 4
**Success Criteria** (what must be TRUE):
  1. Referral program live ("Give 1 month free, get 1 month free")
  2. SEO blog targeting advance tax / TDS / GST keywords indexed
  3. Product Hunt launch executed
  4. 2,000 registered users
**Plans**: TBD

### Phase 6: Platform Integrations (V2)
**Goal**: Zero manual data entry
**Depends on**: Phase 5
**Success Criteria** (what must be TRUE):
  1. Fiverr CSV import works
  2. Toggl/Clockify sync imports hours → auto-calculates earnings
  3. Mobile PWA installable
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 0. Foundation Fix | - | Complete | 2026-03 |
| 1. Tax Intelligence | - | Complete | 2026-03 |
| 2. Monetization Layer | 1/6 | In Progress|  |
| 3. FX Rate Advisor | 0/TBD | Not started | - |
| 4. Beta Launch | 0/TBD | Not started | - |
| 5. Growth & Marketing | 0/TBD | Not started | - |
| 6. Platform Integrations | 0/TBD | Not started | - |
