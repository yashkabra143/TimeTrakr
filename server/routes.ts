import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage.js";
import {
  insertProjectSchema,
  insertDeductionSchema,
  insertCurrencySettingsSchema,
  insertTimeEntrySchema
} from "../shared/schema.js";
import { z } from "zod";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import MemoryStore from "memorystore";

// Simple in-memory user storage for authentication
const users = new Map<string, { id: string; username: string; password: string }>();

// Initialize users with a default user if empty
if (users.size === 0) {
  const defaultUser = {
    id: "user1",
    username: "admin",
    password: "password123",
  };
  users.set("admin", defaultUser);
}

const MemStore = MemoryStore(session);

// Check if we're running in a serverless environment
const isServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

export async function registerRoutes(app: Express): Promise<Server | null> {
  console.log("[ROUTES] Starting registration...", { isServerless });

  // Minimal setup for debugging
  // Handle root path if prefix is stripped
  app.get("/", (_req, res) => {
    console.log("[ROUTE] Root handler hit");
    res.json({ status: "ok", path: "/" });
  });

  // Simple ping endpoint
  app.get("/api/ping", (_req, res) => {
    console.log("[PING] Hit!");
    res.json({ status: "pong", timestamp: Date.now() });
  });

  // Authentication routes
  // Handle both /api/login and /login (in case path is transformed)
  const loginHandler = async (req: Request, res: Response) => {
    try {
      console.log("[LOGIN] Attempting login", {
        method: req.method,
        path: req.path,
        url: req.url,
        body: req.body ? { username: req.body.username, hasPassword: !!req.body.password } : 'no body'
      });
      
      const { username, password } = req.body || {};

      if (!username || !password) {
        console.log("[LOGIN] Missing credentials");
        return res.status(400).json({ message: "Username and password are required" });
      }

      const user = users.get(username);
      if (!user || user.password !== password) {
        console.log("[LOGIN] Invalid credentials for:", username);
        return res.status(401).json({ message: "Invalid username or password" });
      }

      console.log("[LOGIN] Login successful for:", username);
      // Return user without password
      return res.json({ 
        user: { 
          id: user.id, 
          username: user.username 
        } 
      });
    } catch (error) {
      console.error("[LOGIN] Error:", error);
      if (!res.headersSent) {
        return res.status(500).json({ message: "Internal server error" });
      }
    }
  };

  app.post("/api/login", loginHandler);
  app.post("/login", loginHandler); // Fallback in case path is transformed

  app.get("/api/me", async (req, res) => {
    try {
      // For now, return null - proper session-based auth would check session here
      // This is a simple implementation that allows the client to work
      res.json(null);
    } catch (error) {
      console.error("[ME] Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/logout", async (req, res) => {
    try {
      // For now, just return success - proper session-based auth would destroy session here
      res.json({ message: "Logged out successfully" });
    } catch (error) {
      console.error("[LOGOUT] Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Catch-all - MUST be last, after all other routes
  app.all("*", (req, res) => {
    console.log(`[404] Unhandled path: ${req.method} ${req.path}`, {
      method: req.method,
      path: req.path,
      url: req.url,
      originalUrl: req.originalUrl
    });
    if (!res.headersSent) {
      res.status(404).json({ error: "Not Found", path: req.path, method: req.method });
    }
  });

  // Only create HTTP server for traditional deployments (not serverless)
  // In serverless environments (Vercel, AWS Lambda), the platform handles the server
  if (isServerless) {
    console.log("[ROUTES] Serverless environment detected - skipping HTTP server creation");
    return null;
  }

  const httpServer = createServer(app);
  return httpServer;

  /*
  // Health check endpoint
  app.get("/api/health", async (_req, res) => {
    // ...
  });
  // ... rest of the file
  */
}
