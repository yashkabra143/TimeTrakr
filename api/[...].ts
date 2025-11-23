import serverless from "serverless-http";
import { app } from "../server/app";
import { registerRoutes } from "../server/routes";

// Initialize routes and wrap with serverless-http for Vercel
let handler: ReturnType<typeof serverless> | null = null;

async function getHandler() {
  if (!handler) {
    try {
      // Register all routes
      await registerRoutes(app);
      
      // Add error handling middleware (if not already added)
      app.use((err: any, _req: any, res: any, _next: any) => {
        console.error("Unhandled error:", err);
        const status = err.status || err.statusCode || 500;
        const message = err.message || "Internal Server Error";
        res.status(status).json({ error: message });
      });
      
      // Wrap Express app with serverless-http
      handler = serverless(app, {
        binary: ['image/*', 'application/pdf'],
      });
    } catch (error) {
      console.error("Failed to initialize handler:", error);
      throw error;
    }
  }
  return handler;
}

// Export the handler for Vercel
export default async (req: any, res: any) => {
  try {
    const h = await getHandler();
    return await h(req, res);
  } catch (error) {
    console.error("Handler error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

