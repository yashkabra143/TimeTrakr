import serverless from "serverless-http";
import { app } from "../server/app.js";
import { registerRoutes } from "../server/routes.js";

// Initialize routes and wrap with serverless-http for Vercel
let handler: ReturnType<typeof serverless> | null = null;

async function getHandler() {
  if (!handler) {
    const startTime = Date.now();
    try {
      console.log("[INIT] Initializing serverless handler...");
      console.log("[INIT] Environment:", {
        VERCEL: process.env.VERCEL,
        NODE_ENV: process.env.NODE_ENV,
        DATABASE_URL_SET: !!process.env.DATABASE_URL
      });
      
      // Register all routes (this returns a Server, but we don't need it for serverless)
      const server = await registerRoutes(app);
      console.log(`[INIT] Routes registered successfully in ${Date.now() - startTime}ms`);
      
      // Add error handling middleware (if not already added)
      app.use((err: any, _req: any, res: any, _next: any) => {
        console.error("[ERROR] Unhandled error:", err);
        const status = err.status || err.statusCode || 500;
        const message = err.message || "Internal Server Error";
        if (!res.headersSent) {
          res.status(status).json({ error: message });
        }
      });
      
      // Wrap Express app with serverless-http
      handler = serverless(app, {
        binary: ['image/*', 'application/pdf'],
      });
      console.log(`[INIT] Serverless handler created successfully (total: ${Date.now() - startTime}ms)`);
    } catch (error) {
      console.error("[INIT] Failed to initialize handler:", error);
      console.error("[INIT] Error stack:", error instanceof Error ? error.stack : String(error));
      throw error;
    }
  }
  return handler;
}

// Export the handler for Vercel
export default async (req: any, res: any) => {
  try {
    console.log(`[${req.method}] ${req.url}`);
    const h = await getHandler();
    const result = await h(req, res);
    return result;
  } catch (error) {
    console.error("Handler error:", error);
    console.error("Error stack:", error instanceof Error ? error.stack : String(error));
    if (!res.headersSent) {
      res.status(500).json({ 
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }
};

