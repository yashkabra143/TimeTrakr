import "dotenv/config";
import fs from "node:fs";
import { type Server } from "node:http";
import path from "node:path";

import type { Express } from "express";
import { nanoid } from "nanoid";
import { createServer as createViteServer, createLogger } from "vite";

import runApp from "./app";

import viteConfig from "../vite.config";

const viteLogger = createLogger();

export async function setupVite(app: Express, server: Server | null) {
  if (!server) {
    throw new Error("Vite dev server requires an HTTP server instance");
  }
  
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        // Don't exit on Vite errors - let the server continue running
        // This prevents crashes when builder.io or other tools connect
        console.error("[VITE ERROR] (non-fatal):", msg);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    // Skip Vite handling for API routes
    if (req.path.startsWith("/api/")) {
      return next();
    }

    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      console.error("[VITE] Error transforming HTML:", e);
      vite.ssrFixStacktrace(e as Error);
      // Don't call next() for HTML errors - return a basic error page
      if (!res.headersSent) {
        res.status(500).send(`
          <html>
            <body>
              <h1>Development Server Error</h1>
              <p>Vite encountered an error. Check the server logs.</p>
              <pre>${e instanceof Error ? e.message : String(e)}</pre>
            </body>
          </html>
        `);
      }
    }
  });
}

(async () => {
  await runApp(setupVite);
})();
