import serverless from "serverless-http";

let handler: any = null;
let initialized = false;

async function getHandler() {
  if (!handler && !initialized) {
    initialized = true;
    const startTime = Date.now();
    try {
      console.log("[INIT] Starting dynamic initialization...");

      console.log("[INIT] Importing app...");
      const { app } = await import("../server/app.js");
      console.log("[INIT] App imported.");

      console.log("[INIT] Importing routes...");
      const { registerRoutes } = await import("../server/routes.js");
      console.log("[INIT] Routes imported.");

      console.log("[INIT] Initializing serverless handler...");
      console.log("[INIT] Environment:", {
        VERCEL: process.env.VERCEL,
        NODE_ENV: process.env.NODE_ENV,
        DATABASE_URL_SET: !!process.env.DATABASE_URL
      });

      // Register routes (no timeout needed - should be fast in serverless)
      await registerRoutes(app);

      console.log(`[INIT] Routes registered successfully in ${Date.now() - startTime}ms`);

      // Error handling middleware
      app.use((err: any, _req: any, res: any, _next: any) => {
        console.error("[ERROR] Unhandled error:", err);
        const status = err.status || err.statusCode || 500;
        const message = err.message || "Internal Server Error";
        if (!res.headersSent) {
          res.status(status).json({ error: message });
        }
      });

      // Configure serverless-http for Vercel
      // The 'basePath' option ensures paths are handled correctly
      handler = serverless(app, {
        binary: ['image/*', 'application/pdf'],
        request: (request: any, event: any, context: any) => {
          // Ensure request path is preserved
          request.url = request.url || event.path || '/';
          return request;
        }
      });
      console.log(`[INIT] Handler ready (total: ${Date.now() - startTime}ms)`);
    } catch (error) {
      console.error("[INIT] Initialization failed:", error);
      initialized = false; // Allow retry
      throw error;
    }
  }
  return handler;
}

export default async (req: any, res: any) => {
  try {
    // Log detailed request information
    console.log(`[REQUEST] ${req.method} ${req.url}`, {
      path: req.url,
      originalUrl: req.originalUrl,
      method: req.method,
      headers: {
        'content-type': req.headers?.['content-type'],
        'user-agent': req.headers?.['user-agent']?.substring(0, 50)
      }
    });

    const h = await getHandler();
    if (!h) {
      throw new Error('Handler not initialized');
    }

    // Call the handler and ensure we return the result
    // serverless-http returns a promise that resolves when response is sent
    const result = await h(req, res);
    
    // Log if response was sent
    if (res.headersSent) {
      console.log(`[RESPONSE] Sent for ${req.method} ${req.url}`, {
        statusCode: res.statusCode
      });
    } else {
      console.warn(`[WARNING] No response sent for ${req.method} ${req.url} - this will cause timeout!`);
      // If no response was sent, send one now to prevent timeout
      if (!res.headersSent) {
        res.status(500).json({ 
          error: "No response generated",
          path: req.url 
        });
      }
    }
    
    return result;
  } catch (error) {
    console.error("[HANDLER ERROR]:", error);
    if (!res.headersSent) {
      res.status(500).json({
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : String(error),
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
      });
    }
    // Re-throw to ensure Vercel knows there was an error
    throw error;
  }
};
