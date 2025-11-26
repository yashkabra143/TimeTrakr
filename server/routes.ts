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

  // In development, Vite handles the root route, so we skip it
  // In production/serverless, static files are served separately
  if (process.env.NODE_ENV === 'production' || isServerless) {
    // Minimal setup for debugging in production
    app.get("/", (_req, res) => {
      console.log("[ROUTE] Root handler hit");
      res.json({ status: "ok", path: "/" });
    });
  }

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

  // Projects routes
  app.get("/api/projects", async (req, res) => {
    try {
      const projects = await storage.getProjects();
      res.json(projects);
    } catch (error) {
      console.error("[PROJECTS GET] Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/projects", async (req, res) => {
    try {
      const validated = insertProjectSchema.parse(req.body);
      const project = await storage.createProject(validated);
      res.status(201).json(project);
    } catch (error) {
      console.error("[PROJECTS POST] Error:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid project data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.patch("/api/projects/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validated = insertProjectSchema.partial().parse(req.body);
      const project = await storage.updateProject(id, validated);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      console.error("[PROJECTS PATCH] Error:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid project data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.delete("/api/projects/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteProject(id);
      res.status(204).send();
    } catch (error) {
      console.error("[PROJECTS DELETE] Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Deductions routes
  app.get("/api/deductions", async (req, res) => {
    try {
      const deductions = await storage.getDeductions();
      if (!deductions) {
        return res.status(404).json({ message: "Deductions not found" });
      }
      res.json(deductions);
    } catch (error) {
      console.error("[DEDUCTIONS GET] Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/deductions", async (req, res) => {
    try {
      const validated = insertDeductionSchema.partial().parse(req.body);
      const deductions = await storage.updateDeductions(validated);
      res.json(deductions);
    } catch (error) {
      console.error("[DEDUCTIONS PATCH] Error:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid deductions data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  // Currency settings routes
  app.get("/api/currency", async (req, res) => {
    try {
      const currency = await storage.getCurrencySettings();
      if (!currency) {
        return res.status(404).json({ message: "Currency settings not found" });
      }
      res.json(currency);
    } catch (error) {
      console.error("[CURRENCY GET] Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/currency", async (req, res) => {
    try {
      const validated = insertCurrencySettingsSchema.partial().parse(req.body);
      const currency = await storage.updateCurrencySettings(validated);
      res.json(currency);
    } catch (error) {
      console.error("[CURRENCY PATCH] Error:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid currency data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  // Time entries routes
  app.get("/api/entries", async (req, res) => {
    try {
      const entries = await storage.getTimeEntries();
      res.json(entries);
    } catch (error) {
      console.error("[ENTRIES GET] Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/entries", async (req, res) => {
    try {
      const baseEntry = insertTimeEntrySchema.parse(req.body);

      // Get project to get the rate
      const project = await storage.getProject(baseEntry.projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Get deductions and currency settings
      const [deductions, currency] = await Promise.all([
        storage.getDeductions(),
        storage.getCurrencySettings()
      ]);

      if (!deductions || !currency) {
        return res.status(500).json({ message: "Deductions or currency settings not configured" });
      }

      // Calculate fields based on project rate and deductions
      const hours = Number(baseEntry.hours);
      const rate = Number(project.rate);
      const grossUsd = hours * rate;

      // Deductions - stored as percentages (e.g., 10 means 10%)
      const serviceFeePercent = Number(deductions.serviceFee) || 0;
      const tdsPercent = Number(deductions.tds) || 0;
      const gstPercent = Number(deductions.gst) || 0;
      const transferFee = Number(deductions.transferFee) || 0;

      const deductionService = grossUsd * (serviceFeePercent / 100);
      const deductionTds = grossUsd * (tdsPercent / 100);
      const deductionGst = (grossUsd - deductionService - deductionTds) * (gstPercent / 100);
      const deductionTransfer = transferFee;
      const deductionTotal = deductionService + deductionTds + deductionGst + deductionTransfer;

      // Net calculations
      const netBeforeTransfer = grossUsd - deductionService - deductionTds - deductionGst;
      const netUsd = Math.max(0, netBeforeTransfer - deductionTransfer);

      const exchangeRate = Number(currency.usdToInr) || 0;
      const netInr = netUsd * exchangeRate;

      const entry = {
        ...baseEntry,
        grossUsd,
        deductionService,
        deductionGst,
        deductionTds,
        deductionTransfer,
        deductionTotal,
        netUsd,
        netInr,
        exchangeRate,
      };

      const created = await storage.createTimeEntry(entry);
      res.status(201).json(created);
    } catch (error) {
      console.error("[ENTRIES POST] Error:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid entry data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.delete("/api/entries/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteTimeEntry(id);
      res.status(204).send();
    } catch (error) {
      console.error("[ENTRIES DELETE] Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Catch-all - MUST be last, after all other routes
  // In development, Vite handles non-API routes, so we only add catch-all in production/serverless
  if (process.env.NODE_ENV === 'production' || isServerless) {
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
  }

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
