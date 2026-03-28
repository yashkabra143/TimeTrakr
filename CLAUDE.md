# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev           # Start Express backend (port 5000, serves frontend too)
npm run dev:client    # Start Vite frontend only (port 5000)

# Build & Production
npm run build         # Build frontend (Vite) + backend (esbuild)
npm start             # Run production build

# Type checking (no test runner configured)
npm run check         # TypeScript type check

# Database
npm run db:push       # Push Drizzle schema changes to PostgreSQL (Neon)

# One-off migration scripts
npm run migrate:minutes    # Migrate hours → minutes storage format
npm run migrate:user-ids   # Backfill userId on legacy single-user data
npm run fix:identity       # Fix OAuth identity linking
npm run migrate:reminders  # Add reminder fields to users
```

## Architecture

**TimeTrakr** is a full-stack earnings tracker for Indian freelancers earning in USD. It handles tax calculations (Advance Tax, GST, TDS), multi-currency tracking, and tax deadline reminders.

### Stack

- **Frontend:** React 19 + TypeScript, Vite, Tailwind CSS v4, Wouter (routing), Zustand (auth state), React Query (server state), Radix UI + shadcn/ui components
- **Backend:** Express.js + TypeScript (`tsx`), Passport.js (local + Google + GitHub OAuth)
- **Database:** PostgreSQL via Drizzle ORM, Neon serverless HTTP driver (required for Vercel deployment)
- **Deploy:** Vercel serverless — `api/[...].ts` is the entry; Vercel cron handles daily tax reminder emails

### Key directories

- `client/src/pages/` — route-level components (dashboard, history, tax, settings, etc.)
- `client/src/components/` — reusable UI; `ui/` contains Radix/shadcn primitives
- `client/src/lib/` — API client (`api.ts`), React Query hooks (`hooks.ts`), query client config
- `client/src/stores/` — Zustand auth store
- `server/routes.ts` — all API endpoints (~1000 lines, single file)
- `server/storage.ts` — database query abstraction layer (all Drizzle queries here)
- `server/app.ts` — Express setup, session config, Passport middleware
- `server/db.ts` — Drizzle ORM + Neon HTTP client initialization
- `shared/schema.ts` — Drizzle table definitions + Zod insert schemas (shared between client and server)
- `shared/time.ts` — time parsing utilities (H.MM vs fractional format)
- `scripts/` — one-off migration scripts run with `tsx`

### Path aliases (tsconfig + vite)

- `@/` → `client/src/`
- `@shared/` → `shared/`
- `@assets/` → `attached_assets/`
- `@server/` → `server/`

### Data model highlights

All user data is isolated by `userId` (UUID). The main tables are: `users`, `projects`, `timeEntries`, `deductions` (tax config), `currencySettings`, `withdrawals`, `tdsEntries`.

**Time storage:** Time entries store `minutes` (integer) as the canonical format plus `inputFormat` ("hm" or "fractional"). Legacy rows have `hours` (real). The shared `parseTime()` utility handles both. **Critical:** `8.20` means 8h 20m (H.MM), not 8.2 hours.

**Earnings snapshots:** `timeEntries` stores calculated values at creation time (`grossUsd`, `deductions`, `netUsd`, `netInr`, `exchangeRate`) — changing deduction settings does not retroactively update past entries.

### Authentication

Sessions via `express-session` with a PostgreSQL store (survives restarts). All protected API routes use a `requireAuth` middleware. OAuth callbacks are handled by Passport; after OAuth login, users can also set a local password. The `userId` is enforced on every DB query — never trust client-provided `userId`.

### Frontend data flow

Components → React Query hooks (`client/src/lib/hooks.ts`) → API client functions (`client/src/lib/api.ts`) → `fetch()` → Express routes → `storage.ts` → Drizzle → Neon.

### Environment variables

Required in `.env`:
```
DATABASE_URL=          # Neon PostgreSQL connection string
SESSION_SECRET=        # express-session encryption key
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
```
Optional:
```
SENDGRID_API_KEY=      # For tax reminder emails
SENDGRID_FROM_EMAIL=
APP_URL=               # OAuth callback base URL (auto-detected in dev)
```

### Tax features

- **Advance Tax:** Quarterly installments (Jun 15, Sep 15, Dec 15, Mar 15 due dates) calculated from projected annual income; IST timezone used for deadline logic via `Intl.DateTimeFormat`
- **GST:** 18% collected if user is GST-registered; tracked separately
- **TDS:** Section 194J deductions logged in `tdsEntries`; reconciled against advance tax liability
- **Email reminders:** SendGrid + Vercel cron (`vercel.json`) sends daily reminder at 3:30 AM UTC

### Vercel deployment

`vercel.json` configures the build, cron, and routing. The `api/[...].ts` handler wraps the Express app via `serverless-http`. The Neon HTTP driver (not `pg` pools) is required because Vercel serverless functions can't maintain persistent TCP connections.
