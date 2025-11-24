# Fixing Vercel Timeout Issues - Deployment Guide

## What Was Fixed

The timeout errors were caused by two issues:
1. **Wrong database driver**: Using `Pool` from `@neondatabase/serverless` with WebSocket configuration (not supported in Vercel)
2. **Connection string issue**: The `channel_binding=require` parameter causes connection hangs in serverless environments

## Changes Made

### 1. Database Driver (`server/db.ts`)
- **Before**: Used `Pool` with connection pooling and WebSockets
- **After**: Using `neon` HTTP driver with `drizzle-orm/neon-http`
- **Why**: The HTTP driver uses `fetch()` which is perfect for Vercel's serverless functions

### 2. Connection String (`.env` and Vercel env vars)
- **Before**: `postgresql://...?sslmode=require&channel_binding=require`
- **After**: `postgresql://...?sslmode=require` (removed `&channel_binding=require`)
- **Why**: Channel binding can cause timeouts in serverless environments

### 3. Configuration (`vercel.json`)
- Reduced `maxDuration` from 30 to 10 seconds (requests should be fast now)

### 4. Better Logging (`api/[...].ts`)
- Added timing and environment logging to help debug issues

## Deployment Steps

### Step 1: Update Vercel Environment Variables

**CRITICAL**: You must update your `DATABASE_URL` in Vercel:

1. Go to https://vercel.com/dashboard
2. Select your `time-trakr` project
3. Go to **Settings** → **Environment Variables**
4. Find `DATABASE_URL` and click **Edit**
5. Change the value from:
   ```
   postgresql://neondb_owner:npg_Eji9KcSfP4TG@ep-winter-shadow-ahk1609r-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
   ```
   To:
   ```
   postgresql://neondb_owner:npg_Eji9KcSfP4TG@ep-winter-shadow-ahk1609r-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require
   ```
   (Remove `&channel_binding=require`)
6. Make sure it's set for **Production**, **Preview**, and **Development** environments
7. Click **Save**

### Step 2: Commit and Deploy

```bash
# Add all changed files
git add .

# Commit the changes
git commit -m "Fix Vercel timeout: switch to Neon HTTP driver and remove channel_binding"

# Push to trigger deployment
git push
```

### Step 3: Monitor the Deployment

1. Watch the Vercel deployment logs
2. Once deployed, test your endpoints:
   - https://time-trakr.vercel.app/api/health
   - https://time-trakr.vercel.app/api/currency
   - https://time-trakr.vercel.app/api/deductions

### Step 4: Check Logs (if still having issues)

If you still see errors:
1. Go to Vercel Dashboard → Your Project → **Deployments**
2. Click on the latest deployment
3. Go to **Functions** tab
4. Click on `api/[...]` function
5. Check the logs for `[INIT]` and `[ERROR]` messages

## Expected Results

After these changes:
- ✅ API requests should complete in **< 1 second** (not 10-30 seconds)
- ✅ No more "Task timed out" errors
- ✅ Database queries work correctly
- ✅ All `/api/*` endpoints respond properly

## Troubleshooting

### If you still get timeouts:

1. **Check DATABASE_URL in Vercel**:
   - Make sure it doesn't have `&channel_binding=require`
   - Make sure it uses the pooled connection string (has `-pooler` in hostname)

2. **Check Vercel logs** for initialization messages:
   ```
   [INIT] Initializing serverless handler...
   [INIT] Environment: { VERCEL: '1', NODE_ENV: 'production', DATABASE_URL_SET: true }
   [INIT] Routes registered successfully in XXXms
   ```

3. **Verify database is accessible**:
   - Go to your Neon dashboard
   - Check if the database is active and not suspended

4. **Check for cold start issues**:
   - First request after deployment might be slower (cold start)
   - Subsequent requests should be fast

### If you get database connection errors:

- Verify your DATABASE_URL is correct in Vercel
- Make sure your Neon database is not paused
- Check Neon dashboard for connection issues

## Why This Works

The Neon HTTP driver:
- Uses `fetch()` API (fully supported in Vercel)
- No connection pooling needed (handled by Neon's infrastructure)
- Optimized for serverless environments
- No WebSocket dependency
- Fast cold starts

## Testing Locally

To test locally with the new setup:
```bash
npm run dev
```

Then test your endpoints at http://localhost:5000/api/...
