import serverless from "serverless-http";
import { app } from "../server/app.js";
import { registerRoutes } from "../server/routes.js";

let handler: any = null;
let initialized = false;

async function getHandler() {
  if (!handler && !initialized) {
    initialized = true;
    const startTime = Date.now();
    try {
      console.log("[INIT] Initializing serverless handler...");
      console.log("[INIT] Environment:", {
        VERCEL: process.env.VERCEL,
        NODE_ENV: process.env.NODE_ENV,
        DATABASE_URL_SET: !!process.env.DATABASE_URL
      });

      // Register routes with timeout protection
      await Promise.race([
        registerRoutes(app),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Route registration timeout')), 8000)
        )
      ]);

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

      handler = serverless(app);
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
    console.log(`[REQUEST] ${req.method} ${req.url}`);
    const h = await getHandler();
    if (!h) {
      throw new Error('Handler not initialized');
    }
    return await h(req, res);
  } catch (error) {
    console.error("[HANDLER ERROR]:", error);
    if (!res.headersSent) {
      res.status(500).json({
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : String(error),
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
      });
    }
  }
};