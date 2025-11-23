# Netlify Deployment Plan

## Goal Description
Deploy the full-stack TimeTrakr application to Netlify. The frontend (Vite + React) will be hosted as a static site, and the backend (Express + Drizzle) will be deployed as a Netlify Function using `serverless-http`.

## User Review Required
> [!IMPORTANT]
> This deployment strategy assumes the database (NeonDB) is accessible from Netlify Functions. The `DATABASE_URL` environment variable must be set in the Netlify dashboard.

## Proposed Changes

### Configuration
#### [NEW] [netlify.toml](file:///Users/yashkabra/Downloads/TimeTrakr/netlify.toml)
- Configure build settings (`npm run build`).
- Configure redirects: `/*` -> `index.html` (SPA fallback), `/api/*` -> `/.netlify/functions/api` (Backend).

### Backend Adaptation
#### [NEW] [functions/api.ts](file:///Users/yashkabra/Downloads/TimeTrakr/functions/api.ts)
- Import `app` and `registerRoutes`.
- Initialize routes.
- Export `handler` wrapped with `serverless-http`.

### Dependencies
- Install `serverless-http` as a dependency.

## Verification Plan

### Automated Tests
- Run `npm run build` to ensure everything builds locally.

### Manual Verification
- Deploy to Netlify (simulated or user instruction).
- Verify that the frontend loads.
- Verify that API calls (e.g., fetching projects) work via the Netlify Function.
