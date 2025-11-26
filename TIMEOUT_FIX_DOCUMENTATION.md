# Vercel Function Timeout Issue - Root Cause Analysis & Resolution

## Issue Summary

The application was experiencing `FUNCTION_INVOCATION_TIMEOUT` errors on Vercel, where serverless functions were timing out after 30 seconds. Requests to API endpoints (like `/api/login`, `/api/me`, `/api/projects`, etc.) were not completing and returning responses.

## Root Cause Analysis

### Primary Issue: Path Transformation by `serverless-http`

**What was happening:**
- Requests were coming in correctly (e.g., `POST /api/login`)
- But Express was receiving transformed requests (e.g., `GET /`)
- Routes were not matching, causing requests to fall through to catch-all handlers
- No responses were being sent, leading to 30-second timeouts

**Why it happened:**
- The code was using `serverless-http` package to wrap the Express app
- `serverless-http` is designed for AWS Lambda event format
- Vercel's `api/[...].ts` handlers already provide Node.js `req`/`res` objects directly
- The mismatch caused `serverless-http` to incorrectly transform request paths and methods

**Evidence from logs:**
```
[REQUEST] POST /api/login
[DEBUG] Request: GET /  ← Path was transformed!
[WARNING] No response sent for POST /api/login - this will cause timeout!
```

### Secondary Issues

1. **Missing API Routes**: Many routes were commented out or not implemented:
   - `/api/projects` (GET, POST, PATCH, DELETE)
   - `/api/deductions` (GET, PATCH)
   - `/api/currency` (GET, PATCH)
   - `/api/entries` (GET, POST, DELETE)

2. **Unnecessary HTTP Server Creation**: Code was creating HTTP servers even in serverless mode

3. **Incorrect Error Handling**: Error handlers were throwing after sending responses

## Resolution

### 1. Removed `serverless-http` Wrapper

**File: `api/[...].ts`**

**Before:**
```typescript
import serverless from "serverless-http";
// ...
handler = serverless(app, { /* config */ });
return await h(req, res);
```

**After:**
```typescript
// No serverless-http import needed
const expressApp = await getApp();
expressApp(req, res); // Use Express directly
```

**Why this works:**
- Vercel's serverless functions provide standard Node.js `req`/`res` objects
- Express can handle these directly without any wrapper
- Paths and methods are preserved correctly

### 2. Made Routes Serverless-Aware

**File: `server/routes.ts`**

**Changes:**
- Added environment detection: `const isServerless = !!process.env.VERCEL`
- Skip HTTP server creation in serverless mode
- Return `null` instead of a server instance when in serverless

**Before:**
```typescript
export async function registerRoutes(app: Express): Promise<Server> {
  // ... routes ...
  const httpServer = createServer(app);
  return httpServer; // Always created server
}
```

**After:**
```typescript
export async function registerRoutes(app: Express): Promise<Server | null> {
  // ... routes ...
  if (isServerless) {
    return null; // Skip server creation
  }
  const httpServer = createServer(app);
  return httpServer;
}
```

### 3. Implemented Missing API Routes

Added all missing CRUD endpoints:

- **Projects**: Full CRUD operations
- **Deductions**: GET and PATCH
- **Currency Settings**: GET and PATCH  
- **Time Entries**: GET, POST, DELETE with server-side calculations

**Key Implementation Detail:**
Time entry creation now calculates all required fields on the server:
- Fetches project rate, deductions, and currency settings
- Calculates: `grossUsd`, deductions, `netUsd`, `netInr`, `exchangeRate`
- Ensures data consistency and prevents client-side calculation errors

### 4. Fixed Error Handling

**File: `server/app.ts`**

**Before:**
```typescript
app.use((err, req, res, next) => {
  res.status(status).json({ message });
  throw err; // ❌ Throwing after response sent
});
```

**After:**
```typescript
app.use((err, req, res, next) => {
  console.error("[APP ERROR]", err);
  if (!res.headersSent) {
    res.status(status).json({ message });
  }
  // ✅ No throw - just log
});
```

### 5. Increased Timeout Buffer

**File: `vercel.json`**

Changed `maxDuration` from 10 to 30 seconds to provide buffer for:
- Cold starts (first request after deployment)
- Database connection initialization
- Route registration

## Technical Details

### How Vercel Serverless Functions Work

1. **Request Flow:**
   ```
   Client Request → Vercel Router → api/[...].ts → Express App → Route Handler → Response
   ```

2. **Vercel provides:**
   - Standard Node.js `req` (IncomingMessage) object
   - Standard Node.js `res` (ServerResponse) object
   - No transformation needed

3. **Why `serverless-http` was problematic:**
   - Designed for AWS Lambda's event/context format
   - Transforms requests into Lambda-compatible format
   - Then transforms back to Express format
   - This double transformation caused path/method corruption

### Serverless vs Traditional Deployment

**Traditional (Node.js server):**
- Creates HTTP server with `createServer(app)`
- Calls `server.listen(port)`
- Long-running process handles multiple requests

**Serverless (Vercel):**
- No server creation needed
- Platform handles HTTP layer
- Function invoked per request
- Stateless execution

## Files Changed

1. `api/[...].ts` - Removed serverless-http, use Express directly
2. `server/routes.ts` - Added all missing routes, serverless detection
3. `server/app.ts` - Fixed error handling
4. `vercel.json` - Increased timeout, removed debug route

## Verification

After the fix, logs show:
```
[REQUEST] POST /api/login
[DEBUG] Request: POST /api/login  ← Path preserved!
[LOGIN] Attempting login
[LOGIN] Login successful
[RESPONSE] Sent for POST /api/login
```

## Key Learnings

1. **Don't use `serverless-http` with Vercel**: Vercel already provides compatible req/res objects
2. **Environment Detection**: Always check for serverless environment before creating servers
3. **Path Preservation**: Direct Express usage preserves request paths correctly
4. **Error Handling**: Never throw after sending a response
5. **Route Completeness**: Ensure all client-expected routes are implemented

## Prevention

To avoid similar issues in the future:

1. **Test in serverless environment early**: Don't assume local dev works the same
2. **Check logs carefully**: Path transformations are visible in debug logs
3. **Use environment detection**: Always check `process.env.VERCEL` or similar
4. **Avoid unnecessary wrappers**: Use platform-native APIs when possible
5. **Monitor function timeouts**: Set up alerts for timeout errors

## Related Concepts

### Serverless Function Timeouts

- **Purpose**: Prevent runaway functions from consuming resources
- **Default limits**: Vercel Hobby (10s), Pro (60s), Enterprise (900s)
- **Causes**: Long operations, missing responses, infinite loops
- **Solution**: Ensure all code paths send responses, optimize operations

### Express in Serverless

- **Stateless**: Each request is independent
- **Cold starts**: First request may be slower
- **Connection pooling**: Use HTTP drivers, not WebSocket connections
- **Response handling**: Must send response or function times out

## Conclusion

The timeout issue was caused by using `serverless-http` which incorrectly transformed request paths. By removing it and using Express directly with Vercel's native req/res objects, all paths are preserved correctly and requests complete successfully.

