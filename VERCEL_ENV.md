# Vercel Environment Variables Configuration

## Required Environment Variables

### DATABASE_URL
Your Neon database connection string. **IMPORTANT**: Use the connection string WITHOUT `channel_binding=require` for Vercel compatibility.

**Current format (with issue):**
```
postgresql://neondb_owner:npg_xxx@ep-winter-shadow-ahk1609r-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

**Required format for Vercel:**
```
postgresql://neondb_owner:npg_xxx@ep-winter-shadow-ahk1609r-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require
```

Remove the `&channel_binding=require` part from your DATABASE_URL in Vercel environment variables.

## Steps to Update in Vercel:

1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Find the `DATABASE_URL` variable
4. Update it to remove `&channel_binding=require`
5. Redeploy your project

## Why This Matters:

- `channel_binding=require` can cause connection timeouts in serverless environments
- The Neon HTTP driver (which we're now using) works better with simpler connection strings
- Vercel's serverless functions have limited execution time, so connections must be fast

## Additional Notes:

- Make sure you're using the **pooled connection string** from Neon (includes `-pooler` in the URL)
- The new code uses `neon-http` driver which is optimized for serverless
- Connection pooling is handled by Neon's infrastructure, not your application
