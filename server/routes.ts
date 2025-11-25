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
import type { Request as PassportRequest } from "passport";

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

export async function registerRoutes(app: Express): Promise<Server> {
  // Configure session
  app.use(session({
    store: new MemStore({
      checkPeriod: 86400000,
    }),
    secret: "time-tracker-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
    },
  }));

  // Configure passport
  passport.use(new LocalStrategy(
    {
      usernameField: "username",
      passwordField: "password",
    },
    (username, password, done) => {
      const user = users.get(username);
      if (!user || user.password !== password) {
        return done(null, false, { message: "Invalid username or password" });
      }
      return done(null, user);
    }
  ));

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser((id: string, done) => {
    const user = Array.from(users.values()).find(u => u.id === id);
    if (user) {
      done(null, user);
    } else {
      done(null, false);
    }
  });

  app.use(passport.initialize());
  app.use(passport.session());

  // Middleware to check if user is authenticated
  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (req.isAuthenticated && req.isAuthenticated()) {
      next();
    } else {
      res.status(401).json({ error: "Not authenticated" });
    }
  };

  // Authentication routes
  app.post("/api/login", passport.authenticate("local"), (req, res) => {
    res.json({
      success: true,
      user: {
        id: (req.user as any)?.id,
        username: (req.user as any)?.username,
      }
    });
  });

  app.post("/api/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        res.status(500).json({ error: "Failed to logout" });
      } else {
        res.json({ success: true });
      }
    });
  });

  app.get("/api/me", (req, res) => {
    if (req.isAuthenticated && req.isAuthenticated()) {
      res.json({
        id: (req.user as any)?.id,
        username: (req.user as any)?.username,
      });
    } else {
      res.status(401).json({ error: "Not authenticated" });
    }
  });

  // Health check endpoint
  app.get("/api/health", async (_req, res) => {
    try {
      // Test database connection
      await storage.getProjects();
      res.json({ status: "ok", database: "connected" });
    } catch (error) {
      console.error("Health check failed:", error);
      res.status(500).json({ 
        status: "error", 
        database: "disconnected",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Projects (protected routes)
  app.get("/api/projects", requireAuth, async (_req, res) => {
    try {
      const projects = await storage.getProjects();
      res.json(projects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ error: "Failed to fetch projects", details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/projects", requireAuth, async (req, res) => {
    try {
      const project = insertProjectSchema.parse(req.body);
      const newProject = await storage.createProject(project);
      res.status(201).json(newProject);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        console.error("Error creating project:", error);
        res.status(500).json({ error: "Failed to create project", details: error instanceof Error ? error.message : String(error) });
      }
    }
  });

  app.patch("/api/projects/:id", requireAuth, async (req, res) => {
    try {
      const updatedProject = await storage.updateProject(req.params.id, req.body);
      if (!updatedProject) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      res.json(updatedProject);
    } catch (error) {
      res.status(500).json({ error: "Failed to update project" });
    }
  });

  app.delete("/api/projects/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteProject(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete project" });
    }
  });

  // Deductions (protected)
  app.get("/api/deductions", requireAuth, async (_req, res) => {
    try {
      const deductions = await storage.getDeductions();
      res.json(deductions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch deductions" });
    }
  });

  app.patch("/api/deductions", requireAuth, async (req, res) => {
    try {
      const updatedDeductions = await storage.updateDeductions(req.body);
      res.json(updatedDeductions);
    } catch (error) {
      res.status(500).json({ error: "Failed to update deductions" });
    }
  });

  // Currency Settings (protected)
  app.get("/api/currency", requireAuth, async (_req, res) => {
    try {
      const settings = await storage.getCurrencySettings();
      res.json(settings);
    } catch (error) {
      console.error("Error fetching currency settings:", error);
      res.status(500).json({ error: "Failed to fetch currency settings", details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.patch("/api/currency", requireAuth, async (req, res) => {
    try {
      const updatedSettings = await storage.updateCurrencySettings(req.body);
      res.json(updatedSettings);
    } catch (error) {
      res.status(500).json({ error: "Failed to update currency settings" });
    }
  });

  // Time Entries (protected)
  app.get("/api/entries", requireAuth, async (_req, res) => {
    try {
      const entries = await storage.getTimeEntries();
      res.json(entries);
    } catch (error) {
      console.error("Error fetching time entries:", error);
      res.status(500).json({ error: "Failed to fetch time entries", details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/entries", requireAuth, async (req, res) => {
    try {
      const entryData = insertTimeEntrySchema.parse(req.body);

      // Fetch current project to calculate
      const project = await storage.getProject(entryData.projectId);
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      // Fetch current deductions and currency
      const deductions = await storage.getDeductions();
      const currency = await storage.getCurrencySettings();

      if (!deductions || !currency) {
        res.status(500).json({ error: "Configuration not found" });
        return;
      }

      // Calculate earnings using the formula
      const hours = Number(entryData.hours) || 0;
      const rate = Number(project.rate) || 0;
      const grossUsd = hours * rate;

      const serviceFeePercent = Number(deductions.serviceFee) || 0;
      const serviceAmt = grossUsd * (serviceFeePercent / 100);

      const tdsPercent = Number(deductions.tds) || 0;
      const tdsAmt = grossUsd * (tdsPercent / 100);

      const gstPercent = Number(deductions.gst) || 0;
      const gstAmt = serviceAmt * (gstPercent / 100);

      const transferAmt = Number(deductions.transferFee) || 0;

      const netBeforeTransfer = grossUsd - serviceAmt - tdsAmt - gstAmt;
      const netUsd = Math.max(0, netBeforeTransfer - transferAmt);
      const totalDeductions = serviceAmt + tdsAmt + gstAmt + transferAmt;

      const exchangeRate = Number(currency.usdToInr) || 0;
      const netInr = netUsd * exchangeRate;

      const newEntry = await storage.createTimeEntry({
        ...entryData,
        grossUsd,
        deductionService: serviceAmt,
        deductionGst: gstAmt,
        deductionTds: tdsAmt,
        deductionTransfer: transferAmt,
        deductionTotal: totalDeductions,
        netUsd,
        netInr,
        exchangeRate,
      });

      res.status(201).json(newEntry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create time entry" });
      }
    }
  });

  app.delete("/api/entries/:id", async (req, res) => {
    try {
      await storage.deleteTimeEntry(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete time entry" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
