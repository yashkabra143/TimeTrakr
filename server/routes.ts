import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage.js";
import {
  insertProjectSchema,
  insertDeductionSchema,
  insertCurrencySettingsSchema,
  insertTimeEntrySchema,
  insertWithdrawalSchema
} from "../shared/schema.js";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { z } from "zod";

const scryptAsync = promisify(scrypt);



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

  // Initialize default user if none exists
  const existingUser = await storage.getUser("admin");
  if (!existingUser) {
    const salt = randomBytes(16).toString("hex");
    const hashedPassword = (await scryptAsync("password123", salt, 64)) as Buffer;
    await storage.createUser({
      username: "admin",
      password: hashedPassword.toString("hex"),
      salt,
    });
    console.log("[AUTH] Created default admin user");
  }

  // Authentication routes
  const loginHandler = async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body || {};

      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }

      const user = await storage.getUser(username);
      if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
      }

      const hashedPassword = (await scryptAsync(password, user.salt, 64)) as Buffer;
      if (hashedPassword.toString("hex") !== user.password) {
        return res.status(401).json({ message: "Invalid username or password" });
      }

      // Return user without password/salt
      return res.json({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          dateOfBirth: user.dateOfBirth,
          profilePicture: user.profilePicture
        }
      });
    } catch (error) {
      console.error("[LOGIN] Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  };

  app.post("/api/login", loginHandler);
  app.post("/login", loginHandler);

  app.post("/api/change-password", async (req, res) => {
    try {
      const { username, currentPassword, newPassword } = req.body;

      if (!username || !currentPassword || !newPassword) {
        return res.status(400).json({ message: "All fields are required" });
      }

      const user = await storage.getUser(username);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Verify current password
      const hashedCurrent = (await scryptAsync(currentPassword, user.salt, 64)) as Buffer;
      if (hashedCurrent.toString("hex") !== user.password) {
        return res.status(401).json({ message: "Incorrect current password" });
      }

      // Hash new password
      const newSalt = randomBytes(16).toString("hex");
      const hashedNew = (await scryptAsync(newPassword, newSalt, 64)) as Buffer;

      await storage.updateUser(user.id, {
        password: hashedNew.toString("hex"),
        salt: newSalt,
      });

      res.json({ message: "Password updated successfully" });
    } catch (error) {
      console.error("[CHANGE PASSWORD] Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/user", async (req, res) => {
    try {
      const { currentUsername, username, email, fullName, dateOfBirth, profilePicture } = req.body;

      if (!currentUsername) {
        return res.status(400).json({ message: "Current username is required" });
      }

      const user = await storage.getUser(currentUsername);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if new username is already taken (if username is being changed)
      if (username && username !== currentUsername) {
        const existingUser = await storage.getUser(username);
        if (existingUser) {
          return res.status(400).json({ message: "Username already taken" });
        }
      }

      const updatedUser = await storage.updateUser(user.id, {
        username: username || currentUsername,
        email,
        fullName,
        dateOfBirth,
        profilePicture
      });

      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to update user" });
      }

      return res.json({
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          email: updatedUser.email,
          fullName: updatedUser.fullName,
          dateOfBirth: updatedUser.dateOfBirth,
          profilePicture: updatedUser.profilePicture
        }
      });
    } catch (error) {
      console.error("[UPDATE USER] Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/users/:username", async (req, res) => {
    try {
      const { username } = req.params;
      const user = await storage.getUser(username);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      return res.json({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          dateOfBirth: user.dateOfBirth,
          profilePicture: user.profilePicture
        }
      });
    } catch (error) {
      console.error("[GET USER] Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/me", async (req, res) => {
    // Session check would go here
    res.json(null);
  });

  app.post("/api/logout", async (req, res) => {
    res.json({ message: "Logged out successfully" });
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
      // Calculate fields based on project rate and deductions
      const hours = Number(baseEntry.hours);
      const rate = Number(project.rate);

      let grossUsd = 0;
      if (project.type === "fixed") {
        // For fixed projects, use the manual amount passed from frontend
        // If not passed, fallback to rate (assuming rate might be the fixed price)
        grossUsd = Number(baseEntry.manualGrossAmount) || rate;
      } else {
        // Hourly calculation
        grossUsd = hours * rate;
      }

      // Deductions - stored as percentages (e.g., 10 means 10%)
      const serviceFeePercent = Number(deductions.serviceFee) || 0;
      const tdsPercent = Number(deductions.tds) || 0;
      const gstPercent = Number(deductions.gst) || 0;
      const transferFee = Number(deductions.transferFee) || 0;

      const deductionService = grossUsd * (serviceFeePercent / 100);
      const deductionTds = grossUsd * (tdsPercent / 100);
      const deductionGst = deductionService * (gstPercent / 100);
      const deductionTransfer = transferFee;
      const deductionTotal = deductionService + deductionTds + deductionGst;

      // Net calculations (no transfer fee in deductions)
      const netUsd = Math.max(0, grossUsd - deductionTotal);

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

  // Withdrawal routes
  app.get("/api/withdrawals", async (req, res) => {
    try {
      const withdrawals = await storage.getWithdrawals();
      res.json(withdrawals);
    } catch (error) {
      console.error("[WITHDRAWALS GET] Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/withdrawals", async (req, res) => {
    try {
      const validated = insertWithdrawalSchema.parse(req.body);
      const withdrawal = await storage.createWithdrawal(validated);
      res.status(201).json(withdrawal);
    } catch (error) {
      console.error("[WITHDRAWALS POST] Error:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid withdrawal data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.patch("/api/withdrawals/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { paymentStatus } = req.body;

      if (!paymentStatus) {
        return res.status(400).json({ message: "Payment status is required" });
      }

      const withdrawal = await storage.updateWithdrawalStatus(id, paymentStatus);
      if (!withdrawal) {
        return res.status(404).json({ message: "Withdrawal not found" });
      }
      res.json(withdrawal);
    } catch (error) {
      console.error("[WITHDRAWALS PATCH] Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/withdrawals/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteWithdrawal(id);
      res.status(204).send();
    } catch (error) {
      console.error("[WITHDRAWALS DELETE] Error:", error);
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
