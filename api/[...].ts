let app: any = null;
let initialized = false;

async function getApp() {
  if (!app && !initialized) {
    initialized = true;
    const startTime = Date.now();
    try {
      console.log("[INIT] Starting dynamic initialization...");

      console.log("[INIT] Importing app...");
      const { app: expressApp } = await import("../server/app.js");
      console.log("[INIT] App imported.");

      console.log("[INIT] Importing routes...");
      const { registerRoutes } = await import("../server/routes.js");
      console.log("[INIT] Routes imported.");

      console.log("[INIT] Environment:", {
        VERCEL: process.env.VERCEL,
        NODE_ENV: process.env.NODE_ENV,
        DATABASE_URL_SET: !!process.env.DATABASE_URL
      });

      // Register routes (no timeout needed - should be fast in serverless)
      await registerRoutes(expressApp);

      console.log(`[INIT] Routes registered successfully in ${Date.now() - startTime}ms`);

      // Error handling middleware
      expressApp.use((err: any, _req: any, res: any, _next: any) => {
        console.error("[ERROR] Unhandled error:", err);
        const status = err.status || err.statusCode || 500;
        const message = err.message || "Internal Server Error";
        if (!res.headersSent) {
          res.status(status).json({ error: message });
        }
      });

      app = expressApp;
      console.log(`[INIT] Handler ready (total: ${Date.now() - startTime}ms)`);
    } catch (error) {
      console.error("[INIT] Initialization failed:", error);
      initialized = false; // Allow retry
      throw error;
    }
  }
  return app;
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

    const expressApp = await getApp();
    if (!expressApp) {
      throw new Error('App not initialized');
    }

    // Vercel passes req/res directly - use Express app directly without serverless-http
    // This preserves the original path and method
    expressApp(req, res);
    
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
