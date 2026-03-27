import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage.js";
import {
  insertProjectSchema,
  insertDeductionSchema,
  insertCurrencySettingsSchema,
  insertTimeEntrySchema,
  insertWithdrawalSchema,
} from "../shared/schema.js";
import { minutesToHoursDecimal, parseTimeInput } from "../shared/time.js";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { z } from "zod";

const scryptAsync = promisify(scrypt);

const isServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

// ── Auth middleware ───────────────────────────────────────────────────────
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ message: "Unauthorized — please log in" });
  }
  next();
}

export async function registerRoutes(app: Express): Promise<Server | null> {
  console.log("[ROUTES] Starting registration...", { isServerless });

  if (process.env.NODE_ENV === "production" || isServerless) {
    app.get("/", (_req, res) => {
      res.json({ status: "ok", path: "/" });
    });
  }

  app.get("/api/ping", (_req, res) => {
    res.json({ status: "pong", timestamp: Date.now() });
  });

  // Ensure default admin user exists (for existing single-user deployments)
  const existingAdmin = await storage.getUser("admin");
  if (!existingAdmin) {
    const salt = randomBytes(16).toString("hex");
    const hashedPassword = (await scryptAsync("password123", salt, 64)) as Buffer;
    await storage.createUser({
      username: "admin",
      password: hashedPassword.toString("hex"),
      salt,
    });
    console.log("[AUTH] Created default admin user");
  }

  // ── Register ─────────────────────────────────────────────────────────────
  app.post("/api/register", async (req, res) => {
    try {
      const { username, password, email } = req.body || {};

      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }
      if (username.length < 3) {
        return res.status(400).json({ message: "Username must be at least 3 characters" });
      }
      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      const existing = await storage.getUser(username);
      if (existing) {
        return res.status(409).json({ message: "Username already taken" });
      }

      const salt = randomBytes(16).toString("hex");
      const hashedPassword = (await scryptAsync(password, salt, 64)) as Buffer;

      const user = await storage.createUser({
        username,
        password: hashedPassword.toString("hex"),
        salt,
        email: email || null,
      });

      const safeUser = {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        dateOfBirth: user.dateOfBirth,
        profilePicture: user.profilePicture,
      };

      // Auto-login after register
      req.session.userId = user.id;
      req.session.user = safeUser;

      return res.status(201).json({ user: safeUser });
    } catch (error) {
      console.error("[REGISTER] Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── Login ─────────────────────────────────────────────────────────────────
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

      const safeUser = {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        dateOfBirth: user.dateOfBirth,
        profilePicture: user.profilePicture,
      };

      // Set session
      req.session.userId = user.id;
      req.session.user = safeUser;

      return res.json({ user: safeUser });
    } catch (error) {
      console.error("[LOGIN] Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  };

  app.post("/api/login", loginHandler);
  app.post("/login", loginHandler);

  // ── Me (session check) ────────────────────────────────────────────────────
  app.get("/api/me", async (req, res) => {
    if (!req.session?.userId) {
      return res.json(null);
    }
    try {
      const user = await storage.getUserById(req.session.userId);
      if (!user) {
        req.session.destroy(() => {});
        return res.json(null);
      }
      const safeUser = {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        dateOfBirth: user.dateOfBirth,
        profilePicture: user.profilePicture,
      };
      // Keep session user in sync
      req.session.user = safeUser;
      return res.json(safeUser);
    } catch {
      return res.json(null);
    }
  });

  // ── Logout ────────────────────────────────────────────────────────────────
  app.post("/api/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) console.error("[LOGOUT] Error:", err);
      res.clearCookie("connect.sid");
      res.json({ message: "Logged out successfully" });
    });
  });

  // ── OAuth helpers ─────────────────────────────────────────────────────────
  const getAppUrl = () =>
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `http://localhost:${process.env.PORT || 5000}`);

  // ── Google OAuth ──────────────────────────────────────────────────────────
  app.get("/auth/google", (req, res) => {
    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(503).json({ message: "Google OAuth not configured" });
    }
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: `${getAppUrl()}/auth/google/callback`,
      response_type: "code",
      scope: "openid email profile",
    });
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  });

  app.get("/auth/google/callback", async (req, res) => {
    try {
      const code = req.query.code as string;
      if (!code) return res.redirect("/login?error=oauth_cancelled");

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          redirect_uri: `${getAppUrl()}/auth/google/callback`,
          grant_type: "authorization_code",
        }),
      });
      const tokens = await tokenRes.json() as any;
      if (!tokens.access_token) return res.redirect("/login?error=oauth_failed");

      const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const profile = await profileRes.json() as any;

      const user = await storage.findOrCreateOAuthUser({
        provider: "google",
        id: profile.id,
        email: profile.email,
        name: profile.name,
        picture: profile.picture,
      });

      req.session.userId = user.id;
      req.session.user = {
        id: user.id, username: user.username, email: user.email,
        fullName: user.fullName, dateOfBirth: user.dateOfBirth, profilePicture: user.profilePicture,
      };
      res.redirect("/");
    } catch (err) {
      console.error("[GOOGLE OAUTH]", err);
      res.redirect("/login?error=oauth_failed");
    }
  });

  // ── GitHub OAuth ──────────────────────────────────────────────────────────
  app.get("/auth/github", (req, res) => {
    if (!process.env.GITHUB_CLIENT_ID) {
      return res.status(503).json({ message: "GitHub OAuth not configured" });
    }
    const params = new URLSearchParams({
      client_id: process.env.GITHUB_CLIENT_ID,
      redirect_uri: `${getAppUrl()}/auth/github/callback`,
      scope: "read:user user:email",
    });
    res.redirect(`https://github.com/login/oauth/authorize?${params}`);
  });

  app.get("/auth/github/callback", async (req, res) => {
    try {
      const code = req.query.code as string;
      if (!code) return res.redirect("/login?error=oauth_cancelled");

      const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: `${getAppUrl()}/auth/github/callback`,
        }),
      });
      const tokens = await tokenRes.json() as any;
      if (!tokens.access_token) return res.redirect("/login?error=oauth_failed");

      const [profileRes, emailsRes] = await Promise.all([
        fetch("https://api.github.com/user", {
          headers: { Authorization: `Bearer ${tokens.access_token}`, "User-Agent": "TimeFlow" },
        }),
        fetch("https://api.github.com/user/emails", {
          headers: { Authorization: `Bearer ${tokens.access_token}`, "User-Agent": "TimeFlow" },
        }),
      ]);
      const profile = await profileRes.json() as any;
      const emails = await emailsRes.json() as any[];
      const primaryEmail = Array.isArray(emails) ? (emails.find((e: any) => e.primary)?.email ?? null) : null;

      const user = await storage.findOrCreateOAuthUser({
        provider: "github",
        id: String(profile.id),
        email: primaryEmail ?? profile.email ?? null,
        name: profile.name || profile.login,
        picture: profile.avatar_url,
      });

      req.session.userId = user.id;
      req.session.user = {
        id: user.id, username: user.username, email: user.email,
        fullName: user.fullName, dateOfBirth: user.dateOfBirth, profilePicture: user.profilePicture,
      };
      res.redirect("/");
    } catch (err) {
      console.error("[GITHUB OAUTH]", err);
      res.redirect("/login?error=oauth_failed");
    }
  });

  // ── Change password ───────────────────────────────────────────────────────
  app.post("/api/change-password", requireAuth, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.session.userId!;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "All fields are required" });
      }

      const user = await storage.getUserById(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      if (!user.salt || !user.password) {
        return res.status(400).json({ message: "OAuth accounts cannot change password here — use your Google or GitHub account settings" });
      }

      const hashedCurrent = (await scryptAsync(currentPassword, user.salt, 64)) as Buffer;
      if (hashedCurrent.toString("hex") !== user.password) {
        return res.status(401).json({ message: "Incorrect current password" });
      }

      const newSalt = randomBytes(16).toString("hex");
      const hashedNew = (await scryptAsync(newPassword, newSalt, 64)) as Buffer;
      await storage.updateUser(userId, { password: hashedNew.toString("hex"), salt: newSalt });

      res.json({ message: "Password updated successfully" });
    } catch (error) {
      console.error("[CHANGE PASSWORD] Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── Update profile ────────────────────────────────────────────────────────
  app.patch("/api/user", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const { username, email, fullName, dateOfBirth, profilePicture } = req.body;

      // Check if new username is taken
      if (username) {
        const current = await storage.getUserById(userId);
        if (username !== current?.username) {
          const taken = await storage.getUser(username);
          if (taken) return res.status(400).json({ message: "Username already taken" });
        }
      }

      const updatedUser = await storage.updateUser(userId, { username, email, fullName, dateOfBirth, profilePicture });
      if (!updatedUser) return res.status(500).json({ message: "Failed to update user" });

      const safeUser = {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        fullName: updatedUser.fullName,
        dateOfBirth: updatedUser.dateOfBirth,
        profilePicture: updatedUser.profilePicture,
      };

      // Refresh session user
      req.session.user = safeUser;

      return res.json({ user: safeUser });
    } catch (error) {
      console.error("[UPDATE USER] Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/users/:username", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.params.username);
      if (!user) return res.status(404).json({ message: "User not found" });
      return res.json({
        user: {
          id: user.id, username: user.username, email: user.email,
          fullName: user.fullName, dateOfBirth: user.dateOfBirth, profilePicture: user.profilePicture,
        },
      });
    } catch (error) {
      console.error("[GET USER] Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── Projects ──────────────────────────────────────────────────────────────
  app.get("/api/projects", requireAuth, async (req, res) => {
    try {
      const projects = await storage.getProjects(req.session.userId!);
      res.json(projects);
    } catch (error) {
      console.error("[PROJECTS GET] Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/projects", requireAuth, async (req, res) => {
    try {
      const validated = insertProjectSchema.parse(req.body);
      const project = await storage.createProject(validated, req.session.userId!);
      res.status(201).json(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid project data", errors: error.errors });
      } else {
        console.error("[PROJECTS POST] Error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.patch("/api/projects/:id", requireAuth, async (req, res) => {
    try {
      const validated = insertProjectSchema.partial().parse(req.body);
      const project = await storage.updateProject(req.params.id, validated, req.session.userId!);
      if (!project) return res.status(404).json({ message: "Project not found" });
      res.json(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid project data", errors: error.errors });
      } else {
        console.error("[PROJECTS PATCH] Error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.delete("/api/projects/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteProject(req.params.id, req.session.userId!);
      res.status(204).send();
    } catch (error) {
      console.error("[PROJECTS DELETE] Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── Deductions ────────────────────────────────────────────────────────────
  app.get("/api/deductions", requireAuth, async (req, res) => {
    try {
      const deductions = await storage.getDeductions(req.session.userId!);
      res.json(deductions);
    } catch (error) {
      console.error("[DEDUCTIONS GET] Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/deductions", requireAuth, async (req, res) => {
    try {
      const validated = insertDeductionSchema.partial().parse(req.body);
      const deductions = await storage.updateDeductions(req.session.userId!, validated);
      res.json(deductions);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid deductions data", errors: error.errors });
      } else {
        console.error("[DEDUCTIONS PATCH] Error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  // ── Currency ──────────────────────────────────────────────────────────────
  app.get("/api/currency", requireAuth, async (req, res) => {
    try {
      const currency = await storage.getCurrencySettings(req.session.userId!);
      res.json(currency);
    } catch (error) {
      console.error("[CURRENCY GET] Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/currency", requireAuth, async (req, res) => {
    try {
      const validated = insertCurrencySettingsSchema.partial().parse(req.body);
      const currency = await storage.updateCurrencySettings(req.session.userId!, validated);
      res.json(currency);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid currency data", errors: error.errors });
      } else {
        console.error("[CURRENCY PATCH] Error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  // ── Time Entries ──────────────────────────────────────────────────────────
  app.get("/api/entries", requireAuth, async (req, res) => {
    try {
      const entries = await storage.getTimeEntries(req.session.userId!);
      res.json(entries);
    } catch (error) {
      console.error("[ENTRIES GET] Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/entries", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const baseEntry = insertTimeEntrySchema.parse(req.body);

      const minutesProvided = typeof baseEntry.minutes !== "undefined";
      const parsedTime = minutesProvided
        ? { minutes: baseEntry.minutes, usedLegacyFractional: false, hadOverflow: false, source: baseEntry.minutes ?? 0, format: baseEntry.inputFormat ?? "hm" }
        : parseTimeInput(baseEntry.hours ?? 0, { format: baseEntry.inputFormat, allowLegacyInference: true });

      const minutes = parsedTime.minutes ?? 0;
      const inputFormat = baseEntry.inputFormat || (parsedTime.usedLegacyFractional ? "fractional" : "hm");
      const hoursDecimal = minutesToHoursDecimal(minutes);

      const project = await storage.getProject(baseEntry.projectId, userId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      const [deductions, currency] = await Promise.all([
        storage.getDeductions(userId),
        storage.getCurrencySettings(userId),
      ]);

      const rate = Number(project.rate);
      let grossUsd = 0;
      if (project.type === "fixed") {
        grossUsd = Number(baseEntry.manualGrossAmount) || rate;
      } else {
        grossUsd = hoursDecimal * rate;
      }

      const serviceFeePercent = Number(deductions.serviceFee) || 0;
      const tdsPercent = Number(deductions.tds) || 0;
      const gstPercent = Number(deductions.gst) || 0;

      const deductionService = grossUsd * (serviceFeePercent / 100);
      const deductionTds = grossUsd * (tdsPercent / 100);
      const deductionGst = deductionService * (gstPercent / 100);
      const deductionTransfer = 0;
      const deductionTotal = deductionService + deductionTds + deductionGst;
      const netUsd = Math.max(0, grossUsd - deductionTotal);
      const exchangeRate = Number(currency.usdToInr) || 0;
      const netInr = netUsd * exchangeRate;

      const { hours: _h, manualGrossAmount: _m, ...cleanEntry } = baseEntry;
      const created = await storage.createTimeEntry({
        ...cleanEntry,
        userId,
        minutes,
        inputFormat,
        rawInput: baseEntry.rawInput ?? String(parsedTime.source ?? ""),
        grossUsd, deductionService, deductionGst, deductionTds,
        deductionTransfer, deductionTotal, netUsd, netInr, exchangeRate,
      });

      res.status(201).json(created);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid entry data", errors: error.errors });
      } else {
        console.error("[ENTRIES POST] Error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.delete("/api/entries/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteTimeEntry(req.params.id, req.session.userId!);
      res.status(204).send();
    } catch (error) {
      console.error("[ENTRIES DELETE] Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── CSV Import: Time Entries ───────────────────────────────────────────────
  app.post("/api/entries/import", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const { csv } = req.body as { csv: string };
      if (!csv || typeof csv !== "string")
        return res.status(400).json({ message: "No CSV content provided" });

      function parseCSVLine(line: string): string[] {
        const result: string[] = [];
        let cur = "";
        let inQuotes = false;
        for (let ci = 0; ci < line.length; ci++) {
          const ch = line[ci];
          if (ch === '"') { inQuotes = !inQuotes; }
          else if (ch === "," && !inQuotes) { result.push(cur.trim()); cur = ""; }
          else { cur += ch; }
        }
        result.push(cur.trim());
        return result;
      }

      function parseDate(str: string): Date | null {
        if (!str) return null;
        if (str.includes("/")) {
          const d = new Date(str);
          return isNaN(d.getTime()) ? null : d;
        }
        const d = new Date(str + "T00:00:00");
        return isNaN(d.getTime()) ? null : d;
      }

      const lines = csv.trim().split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2)
        return res.status(400).json({ message: "CSV must have a header row and at least one data row" });

      const rawHeaders = parseCSVLine(lines[0]);
      const headers = rawHeaders.map(h => h.toLowerCase().replace(/"/g, "").trim());
      const isUpwork = headers.includes("transaction id") || headers.includes("transaction type") || headers.includes("amount $");

      const [projects, deductions, currency] = await Promise.all([
        storage.getProjects(userId),
        storage.getDeductions(userId),
        storage.getCurrencySettings(userId),
      ]);

      const exchangeRate = Number(currency.usdToInr) || 0;
      const imported: string[] = [];
      const failed: { row: number; reason: string }[] = [];
      let skipped = 0;

      const EARNINGS_TYPES = [
        "hourly", "fixed-price", "fixed price", "bonus", "manual time",
        "client funded milestone", "milestone payment", "hourly payment",
      ];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = parseCSVLine(line);
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => { row[h] = (values[idx] ?? "").replace(/^"|"$/g, "").trim(); });

        if (isUpwork) {
          const txType = (row["transaction type"] || "").toLowerCase();
          const amtRaw = row["amount $"] || row["amount"] || "";
          const amtVal = parseFloat(amtRaw.replace(/[^0-9.\-]/g, ""));

          if (isNaN(amtVal) || amtVal <= 0) { skipped++; continue; }
          const isEarning = EARNINGS_TYPES.some(t => txType.includes(t)) || amtVal > 0;
          if (!isEarning) { skipped++; continue; }

          const dateVal = parseDate(row["date"]);
          if (!dateVal) { failed.push({ row: i, reason: `Invalid date: "${row["date"]}"` }); continue; }

          const descParts = [row["transaction summary"], row["transaction summary details"], row["description 1"], row["description 2"], row["description 3"]].filter(Boolean);
          const description = descParts.join(" · ").slice(0, 500) || null;

          const tryNames = [row["transaction summary"], row["client team"], row["account name"], row["freelancer"]].filter(Boolean);
          let project = tryNames.reduce<typeof projects[0] | undefined>((found, name) =>
            found ?? projects.find(p => p.name.toLowerCase() === name.toLowerCase()), undefined);
          if (!project) project = projects[0];
          if (!project) { failed.push({ row: i, reason: "No projects found — create one first" }); continue; }

          const grossUsd = amtVal;
          const svc = grossUsd * ((Number(deductions.serviceFee) || 0) / 100);
          const tds = grossUsd * ((Number(deductions.tds) || 0) / 100);
          const gst = svc * ((Number(deductions.gst) || 0) / 100);
          const total = svc + tds + gst;
          const netUsd = Math.max(0, grossUsd - total);

          try {
            const entry = await storage.createTimeEntry({
              projectId: project.id, userId, minutes: 0, inputFormat: "fractional",
              rawInput: String(amtVal), date: dateVal, description, grossUsd,
              deductionService: svc, deductionGst: gst, deductionTds: tds,
              deductionTransfer: 0, deductionTotal: total, netUsd,
              netInr: netUsd * exchangeRate, exchangeRate,
            });
            imported.push(entry.id);
          } catch { failed.push({ row: i, reason: "Failed to save entry" }); }

        } else {
          const dateVal = parseDate(row["date"]);
          if (!dateVal) { failed.push({ row: i, reason: `Invalid date: "${row["date"]}"` }); continue; }

          const hoursVal = parseFloat(row["hours"]);
          if (isNaN(hoursVal) || hoursVal <= 0) { failed.push({ row: i, reason: `Invalid hours: "${row["hours"]}"` }); continue; }

          const projectName = row["contract"] || row["project"] || "";
          const project = projects.find(p => p.name.toLowerCase() === projectName.toLowerCase());
          if (!project) { failed.push({ row: i, reason: `Project not found: "${projectName}"` }); continue; }

          const minutes = Math.round(hoursVal * 60);
          const rate = Number(project.rate);
          const grossUsd = hoursVal * rate;
          const svc = grossUsd * ((Number(deductions.serviceFee) || 0) / 100);
          const tds = grossUsd * ((Number(deductions.tds) || 0) / 100);
          const gst = svc * ((Number(deductions.gst) || 0) / 100);
          const total = svc + tds + gst;
          const netUsd = Math.max(0, grossUsd - total);

          try {
            const entry = await storage.createTimeEntry({
              projectId: project.id, userId, minutes, inputFormat: "fractional",
              rawInput: String(hoursVal), date: dateVal, description: row["description"] || null,
              grossUsd, deductionService: svc, deductionGst: gst, deductionTds: tds,
              deductionTransfer: 0, deductionTotal: total, netUsd,
              netInr: netUsd * exchangeRate, exchangeRate,
            });
            imported.push(entry.id);
          } catch { failed.push({ row: i, reason: "Failed to save entry" }); }
        }
      }

      res.json({ imported: imported.length, failed, skipped, total: lines.length - 1 });
    } catch (error) {
      console.error("[ENTRIES IMPORT] Error:", error);
      res.status(500).json({ message: "Import failed" });
    }
  });

  // ── Withdrawals ───────────────────────────────────────────────────────────
  app.get("/api/withdrawals", requireAuth, async (req, res) => {
    try {
      const withdrawals = await storage.getWithdrawals(req.session.userId!);
      res.json(withdrawals);
    } catch (error) {
      console.error("[WITHDRAWALS GET] Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/withdrawals", requireAuth, async (req, res) => {
    try {
      const validated = insertWithdrawalSchema.parse(req.body);
      const withdrawal = await storage.createWithdrawal(validated, req.session.userId!);
      res.status(201).json(withdrawal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid withdrawal data", errors: error.errors });
      } else {
        console.error("[WITHDRAWALS POST] Error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.patch("/api/withdrawals/:id", requireAuth, async (req, res) => {
    try {
      const { paymentStatus } = req.body;
      if (!paymentStatus) return res.status(400).json({ message: "Payment status is required" });

      const withdrawal = await storage.updateWithdrawalStatus(req.params.id, paymentStatus, req.session.userId!);
      if (!withdrawal) return res.status(404).json({ message: "Withdrawal not found" });
      res.json(withdrawal);
    } catch (error) {
      console.error("[WITHDRAWALS PATCH] Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/withdrawals/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteWithdrawal(req.params.id, req.session.userId!);
      res.status(204).send();
    } catch (error) {
      console.error("[WITHDRAWALS DELETE] Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── CSV Import: Withdrawals ───────────────────────────────────────────────
  app.post("/api/withdrawals/import", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const { csv } = req.body as { csv: string };
      if (!csv || typeof csv !== "string")
        return res.status(400).json({ message: "No CSV content provided" });

      const lines = csv.trim().split(/\r?\n/);
      if (lines.length < 2) return res.status(400).json({ message: "CSV must have a header and at least one row" });

      const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/"/g, ""));
      if (!headers.includes("date") || !headers.includes("amount"))
        return res.status(400).json({ message: "Missing required columns: date, amount" });

      const imported: string[] = [];
      const failed: { row: number; reason: string }[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = line.match(/(".*?"|[^,]+)(?=,|$)/g)?.map(v => v.trim().replace(/^"|"$/g, "")) ?? line.split(",").map(v => v.trim());
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => { row[h] = values[idx]?.trim() ?? ""; });

        const dateVal = row.date.includes("/") ? new Date(row.date) : new Date(row.date + "T00:00:00");
        if (isNaN(dateVal.getTime())) { failed.push({ row: i, reason: `Invalid date: "${row.date}"` }); continue; }

        const amount = parseFloat(row.amount);
        if (isNaN(amount) || amount <= 0) { failed.push({ row: i, reason: `Invalid amount: "${row.amount}"` }); continue; }

        const transactionFee = 0.99;
        const withdrawalAmount = Math.max(0, amount - transactionFee);
        const status = ["pending", "received"].includes((row.status || "").toLowerCase()) ? (row.status || "pending").toLowerCase() : "pending";

        try {
          const w = await storage.createWithdrawal({
            netEarnings: amount, transactionFee, withdrawalAmount,
            withdrawalDate: dateVal, paymentStatus: status, notes: row.notes || null,
          }, userId);
          imported.push(w.id);
        } catch {
          failed.push({ row: i, reason: "Failed to save withdrawal" });
        }
      }

      res.json({ imported: imported.length, failed, total: lines.length - 1 });
    } catch (error) {
      console.error("[WITHDRAWALS IMPORT] Error:", error);
      res.status(500).json({ message: "Import failed" });
    }
  });

  // ── Catch-all (production) ────────────────────────────────────────────────
  if (process.env.NODE_ENV === "production" || isServerless) {
    app.all("*", (req, res) => {
      if (!res.headersSent) {
        res.status(404).json({ error: "Not Found", path: req.path });
      }
    });
  }

  if (isServerless) {
    console.log("[ROUTES] Serverless mode — skipping HTTP server creation");
    return null;
  }

  return createServer(app);
}
