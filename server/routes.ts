import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage.js";
import { registerSubscriptionRoutes } from "./subscription-routes.js";
import {
  insertProjectSchema,
  insertDeductionSchema,
  insertCurrencySettingsSchema,
  insertTimeEntrySchema,
  insertWithdrawalSchema,
  insertTdsEntrySchema,
} from "../shared/schema.js";
import { minutesToHoursDecimal, parseTimeInput } from "../shared/time.js";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { z } from "zod";
import rateLimit from "express-rate-limit";

const scryptAsync = promisify(scrypt);

const isServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

// Max data rows accepted in a single CSV import (DoS guard).
const MAX_CSV_ROWS = 5000;

// ── Rate limiters ───────────────────────────────────────────────────────────
// NOTE: the default store is in-memory (per-instance). On serverless this
// limits each warm instance independently; for hard guarantees across
// instances, back this with a shared store (Redis/Postgres) later.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                  // 10 attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts. Please try again in a few minutes." },
});

// Looser limit for general authenticated API traffic.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please slow down." },
});

// ── Validation helpers ────────────────────────────────────────────────────
const emailSchema = z.string().email().max(254);
// Password policy: min 8 chars, at least one letter and one number.
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(200, "Password is too long")
  .regex(/[A-Za-z]/, "Password must contain a letter")
  .regex(/[0-9]/, "Password must contain a number");

const updateUserSchema = z.object({
  username: z.string().min(3).max(50).optional(),
  email: z.string().email().max(254).optional().nullable(),
  fullName: z.string().max(100).optional().nullable(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  // Allow https URLs (OAuth avatars) or data:image/... base64 (local uploads) or empty string
  profilePicture: z.string().refine(
    v => v === "" || v === null || v.startsWith("https://") || /^data:image\/(png|jpeg|jpg|gif|webp);base64,/.test(v),
    { message: "profilePicture must be an https URL or a base64 image data URI" }
  ).optional().nullable(),
  reminderEnabled: z.boolean().optional(),
});

// ── CSV helpers (shared by the import endpoints) ──────────────────────────
// RFC-4180-ish parser: respects quoted fields, embedded newlines (Upwork wraps
// multi-line titles in quotes) and "" escaped quotes. Returns one string[] per
// logical record — NOT per physical line.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let ci = 0; ci < text.length; ci++) {
    const ch = text[ci];
    if (inQuotes) {
      if (ch === '"') {
        if (text[ci + 1] === '"') { cur += '"'; ci++; } // escaped quote
        else inQuotes = false;
      } else { cur += ch; }
    } else if (ch === '"') { inQuotes = true; }
    else if (ch === ",") { row.push(cur); cur = ""; }
    else if (ch === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
    else if (ch !== "\r") { cur += ch; }
  }
  if (cur !== "" || row.length > 0) { row.push(cur); rows.push(row); }
  return rows;
}

// Accepts ISO (yyyy-mm-dd, anchored to local midnight to avoid UTC day-shift),
// slash dates, and Upwork's "Jun 19, 2026" format.
function parseCsvDate(str: string): Date | null {
  const s = (str || "").trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s + "T00:00:00");
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// ── Auth middleware ───────────────────────────────────────────────────────
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ message: "Unauthorized — please log in" });
  }
  next();
}

function requirePro(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ message: "Unauthorized — please log in" });
  }
  const user = req.session.user;
  if (!user) {
    return res.status(401).json({ message: "Unauthorized — please log in" });
  }
  const isPro =
    user.planType !== "free" &&
    (user.planExpiresAt === null || new Date(user.planExpiresAt) > new Date());
  if (!isPro) {
    return res.status(403).json({ message: "Pro subscription required", code: "PRO_REQUIRED" });
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

  // General API rate limit (skips the ping healthcheck above).
  app.use("/api/", apiLimiter);

  // ── Register ─────────────────────────────────────────────────────────────
  app.post("/api/register", authLimiter, async (req, res) => {
    try {
      const { username, password, email } = req.body || {};

      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }
      if (typeof username !== "string" || username.length < 3 || username.length > 50) {
        return res.status(400).json({ message: "Username must be between 3 and 50 characters" });
      }

      const passwordCheck = passwordSchema.safeParse(password);
      if (!passwordCheck.success) {
        return res.status(400).json({ message: passwordCheck.error.errors[0]?.message ?? "Invalid password" });
      }

      if (email != null && email !== "") {
        const emailCheck = emailSchema.safeParse(email);
        if (!emailCheck.success) {
          return res.status(400).json({ message: "Invalid email address" });
        }
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
        planType: user.planType ?? "free",
        planExpiresAt: user.planExpiresAt?.toISOString() ?? null,
      };

      // Regenerate session to prevent session fixation, then auto-login
      await new Promise<void>((resolve, reject) => {
        req.session.regenerate((err) => (err ? reject(err) : resolve()));
      });
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

      // OAuth-only accounts have no local password — reject cleanly (not a 500).
      if (!user.salt || !user.password) {
        return res.status(401).json({ message: "Invalid username or password" });
      }

      const hashedPassword = (await scryptAsync(password, user.salt, 64)) as Buffer;
      const storedPassword = Buffer.from(user.password, "hex");
      if (
        hashedPassword.length !== storedPassword.length ||
        !timingSafeEqual(hashedPassword, storedPassword)
      ) {
        return res.status(401).json({ message: "Invalid username or password" });
      }

      const safeUser = {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        dateOfBirth: user.dateOfBirth,
        profilePicture: user.profilePicture,
        planType: user.planType ?? "free",
        planExpiresAt: user.planExpiresAt?.toISOString() ?? null,
      };

      // Regenerate session to prevent session fixation
      await new Promise<void>((resolve, reject) => {
        req.session.regenerate((err) => (err ? reject(err) : resolve()));
      });
      req.session.userId = user.id;
      req.session.user = safeUser;
      return res.json({ user: safeUser });
    } catch (error) {
      console.error("[LOGIN] Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  };

  app.post("/api/login", authLimiter, loginHandler);
  app.post("/login", authLimiter, loginHandler);

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
        planType: user.planType ?? "free",
        planExpiresAt: user.planExpiresAt?.toISOString() ?? null,
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

  // Generate + persist an anti-CSRF state token, then run the callback.
  const issueOAuthState = (req: Request): string => {
    const state = randomBytes(16).toString("hex");
    req.session.oauthState = state;
    return state;
  };
  // Validate the returned state against the session, then clear it (one-time use).
  const verifyOAuthState = (req: Request): boolean => {
    const expected = req.session.oauthState;
    const actual = req.query.state as string | undefined;
    req.session.oauthState = undefined;
    return Boolean(expected) && Boolean(actual) && expected === actual;
  };

  // ── Google OAuth ──────────────────────────────────────────────────────────
  app.get("/auth/google", (req, res) => {
    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(503).json({ message: "Google OAuth not configured" });
    }
    const state = issueOAuthState(req);
    // Persist the state to the session store before redirecting.
    req.session.save(() => {
      const params = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        redirect_uri: `${getAppUrl()}/auth/google/callback`,
        response_type: "code",
        scope: "openid email profile",
        state,
      });
      res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
    });
  });

  app.get("/auth/google/callback", async (req, res) => {
    try {
      if (!verifyOAuthState(req)) return res.redirect("/login?error=oauth_state");
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

      await new Promise<void>((resolve, reject) => {
        req.session.regenerate((err) => (err ? reject(err) : resolve()));
      });
      req.session.userId = user.id;
      req.session.user = {
        id: user.id, username: user.username, email: user.email,
        fullName: user.fullName, dateOfBirth: user.dateOfBirth, profilePicture: user.profilePicture,
        planType: user.planType ?? "free",
        planExpiresAt: user.planExpiresAt?.toISOString() ?? null,
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
    const state = issueOAuthState(req);
    req.session.save(() => {
      const params = new URLSearchParams({
        client_id: process.env.GITHUB_CLIENT_ID!,
        redirect_uri: `${getAppUrl()}/auth/github/callback`,
        scope: "read:user user:email",
        state,
      });
      res.redirect(`https://github.com/login/oauth/authorize?${params}`);
    });
  });

  app.get("/auth/github/callback", async (req, res) => {
    try {
      if (!verifyOAuthState(req)) return res.redirect("/login?error=oauth_state");
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

      await new Promise<void>((resolve, reject) => {
        req.session.regenerate((err) => (err ? reject(err) : resolve()));
      });
      req.session.userId = user.id;
      req.session.user = {
        id: user.id, username: user.username, email: user.email,
        fullName: user.fullName, dateOfBirth: user.dateOfBirth, profilePicture: user.profilePicture,
        planType: user.planType ?? "free",
        planExpiresAt: user.planExpiresAt?.toISOString() ?? null,
      };
      res.redirect("/");
    } catch (err) {
      console.error("[GITHUB OAUTH]", err);
      res.redirect("/login?error=oauth_failed");
    }
  });

  // ── Change password ───────────────────────────────────────────────────────
  app.post("/api/change-password", authLimiter, requireAuth, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.session.userId!;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "All fields are required" });
      }

      const passwordCheck = passwordSchema.safeParse(newPassword);
      if (!passwordCheck.success) {
        return res.status(400).json({ message: passwordCheck.error.errors[0]?.message ?? "Invalid password" });
      }

      const user = await storage.getUserById(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      if (!user.salt || !user.password) {
        return res.status(400).json({ message: "OAuth accounts cannot change password here — use your Google or GitHub account settings" });
      }

      const hashedCurrent = (await scryptAsync(currentPassword, user.salt, 64)) as Buffer;
      if (!timingSafeEqual(hashedCurrent, Buffer.from(user.password, "hex"))) {
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

      const parsed = updateUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid input" });
      }
      const { username, email, fullName, dateOfBirth, profilePicture, reminderEnabled } = parsed.data;

      // Gate reminder toggle behind Pro subscription
      if (reminderEnabled === true) {
        const sessionUser = req.session?.user;
        const isPro = sessionUser && sessionUser.planType !== "free" &&
          (sessionUser.planExpiresAt === null || new Date(sessionUser.planExpiresAt) > new Date());
        if (!isPro) {
          return res.status(403).json({ message: "Pro subscription required for email reminders", code: "PRO_REQUIRED" });
        }
      }

      // Check if new username is taken
      if (username) {
        const current = await storage.getUserById(userId);
        if (username !== current?.username) {
          const taken = await storage.getUser(username);
          if (taken) return res.status(400).json({ message: "Username already taken" });
        }
      }

      const updatedUser = await storage.updateUser(userId, { username, email, fullName, dateOfBirth, profilePicture, reminderEnabled });
      if (!updatedUser) return res.status(500).json({ message: "Failed to update user" });

      const safeUser = {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        fullName: updatedUser.fullName,
        dateOfBirth: updatedUser.dateOfBirth,
        profilePicture: updatedUser.profilePicture,
        planType: updatedUser.planType ?? "free",
        planExpiresAt: updatedUser.planExpiresAt?.toISOString() ?? null,
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
      // Prevent user enumeration / PII disclosure: only the owner may read
      // their own record (email, DOB, etc.) through this endpoint.
      if (user.id !== req.session.userId) {
        return res.status(403).json({ message: "Forbidden" });
      }
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

  // ── Live exchange rate proxy ───────────────────────────────────────────────
  app.get("/api/exchange-rate/live", requireAuth, async (_req, res) => {
    try {
      // Try Frankfurter first
      const r = await fetch("https://api.frankfurter.dev/v1/latest?base=USD&symbols=INR");
      if (r.ok) {
        const data = await r.json() as { rates?: { INR?: number } };
        const rate = data.rates?.INR;
        if (rate) return res.json({ rate });
      }
    } catch { /* fall through to backup */ }

    try {
      // Backup: ExchangeRate-API (no key required, 1500 req/month free)
      const r2 = await fetch("https://open.er-api.com/v6/latest/USD");
      if (r2.ok) {
        const data = await r2.json() as { rates?: { INR?: number } };
        const rate = data.rates?.INR;
        if (rate) return res.json({ rate });
      }
    } catch { /* fall through */ }

    res.status(502).json({ message: "Could not fetch live exchange rate. Try again later." });
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
  app.post("/api/entries/import", requireAuth, requirePro, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const { csv } = req.body as { csv: string };
      if (!csv || typeof csv !== "string")
        return res.status(400).json({ message: "No CSV content provided" });

      const records = parseCsv(csv.trim());
      if (records.length < 2)
        return res.status(400).json({ message: "CSV must have a header row and at least one data row" });
      if (records.length - 1 > MAX_CSV_ROWS)
        return res.status(413).json({ message: `Too many rows (max ${MAX_CSV_ROWS}). Split the file and import in batches.` });

      const headers = records[0].map(h => h.toLowerCase().replace(/"/g, "").trim());
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

      for (let i = 1; i < records.length; i++) {
        const values = records[i];
        if (values.every(v => !v.trim())) continue;

        const row: Record<string, string> = {};
        headers.forEach((h, idx) => { row[h] = (values[idx] ?? "").trim(); });

        if (isUpwork) {
          const txType = (row["transaction type"] || "").toLowerCase();
          const amtRaw = row["amount $"] || row["amount"] || "";
          const amtVal = parseFloat(amtRaw.replace(/[^0-9.\-]/g, ""));

          if (isNaN(amtVal) || amtVal <= 0) { skipped++; continue; }
          const isEarning = EARNINGS_TYPES.some(t => txType.includes(t)) || amtVal > 0;
          if (!isEarning) { skipped++; continue; }

          const dateVal = parseCsvDate(row["date"]);
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
          const dateVal = parseCsvDate(row["date"]);
          if (!dateVal) { failed.push({ row: i, reason: `Invalid date: "${row["date"]}"` }); continue; }

          const hoursVal = parseFloat(row["hours"]);
          if (isNaN(hoursVal) || hoursVal <= 0) { failed.push({ row: i, reason: `Invalid hours: "${row["hours"]}"` }); continue; }

          // Contract name is ignored for now — Upwork's long contract titles
          // don't map to project names. Match by name if one happens to align,
          // otherwise fall back to the first project (same as the Upwork branch).
          const projectName = row["contract"] || row["project"] || "";
          let project = projectName
            ? projects.find(p => p.name.toLowerCase() === projectName.toLowerCase())
            : undefined;
          if (!project) project = projects[0];
          if (!project) { failed.push({ row: i, reason: "No projects found — create one first" }); continue; }

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

      res.json({ imported: imported.length, failed, skipped, total: records.length - 1 });
    } catch (error) {
      console.error("[ENTRIES IMPORT] Error:", error);
      res.status(500).json({ message: "Import failed" });
    }
  });

  // ── Reminders (Twilio SMS / WhatsApp) ─────────────────────────────────────

  app.post("/api/reminders/test", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUserById(req.session.userId!);
      if (!user?.email) {
        return res.status(400).json({ message: "No email address on your account. Add one in Profile first." });
      }
      if (!user.reminderEnabled) {
        return res.status(400).json({ message: "Enable email reminders in Settings → Financials → Tax Reminders first." });
      }
      const { sendEmail } = await import("./email.js");
      await sendEmail(
        user.email,
        "👋 Test — TimeTrakr Tax Reminders are working!",
        `<div style="font-family:sans-serif;padding:24px"><h2>It works!</h2><p>Your advance tax email reminders are set up correctly. You'll receive alerts 7 days before, 3 days before, and on each advance tax due date.</p></div>`
      );
      return res.json({ sent: ["email"] });
    } catch (error: any) {
      console.error("[REMINDER TEST] Error:", error);
      res.status(500).json({ message: "Failed to send test email" });
    }
  });

  app.get("/api/crons/tax-reminders", async (req, res) => {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const { sendEmail, buildReminderEmail, getAdvanceTaxDates, getFyStartYear } = await import("./email.js");

      // Today in IST — derive calendar date explicitly to avoid fixed-offset errors near midnight
      const istParts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric", month: "2-digit", day: "2-digit",
      }).formatToParts(new Date());
      const istYear  = Number(istParts.find(p => p.type === "year")!.value);
      const istMonth = Number(istParts.find(p => p.type === "month")!.value);
      const istDay   = Number(istParts.find(p => p.type === "day")!.value);
      const today = new Date(Date.UTC(istYear, istMonth - 1, istDay, 0, 0, 0));

      const fyStart = getFyStartYear(today);
      const dueDates = getAdvanceTaxDates(fyStart);
      const REMINDER_DAYS = [7, 3, 0];

      // Find which installments need a reminder today
      const todayTime = today.getTime();
      const activeReminders = dueDates.flatMap((inst) => {
        return REMINDER_DAYS
          .filter((days) => {
            const triggerDate = new Date(inst.dueDate.getTime() - days * 24 * 60 * 60 * 1000);
            triggerDate.setUTCHours(0, 0, 0, 0);
            return triggerDate.getTime() === todayTime;
          })
          .map((days) => ({ ...inst, daysUntil: days }));
      });

      if (activeReminders.length === 0) {
        return res.json({ skipped: true, reason: "No reminders scheduled for today" });
      }

      const reminderUsers = await storage.getUsersWithRemindersEnabled();
      const proUsers = reminderUsers.filter(u =>
        u.planType !== "free" &&
        (u.planExpiresAt === null || (u.planExpiresAt && new Date(u.planExpiresAt) > new Date()))
      );
      let sent = 0;
      let failed = 0;

      for (const user of proUsers) {
        if (!user.email) continue;

        const entries = await storage.getTimeEntries(user.id);
        const deductions = await storage.getDeductions(user.id);
        const fyEntries = entries.filter((e) => getFyStartYear(new Date(e.date)) === fyStart);
        const ytdNetInr = fyEntries.reduce((s, e) => s + (e.netInr ?? 0), 0);
        const fromDate = new Date(fyStart, 3, 1);
        const monthsElapsed = Math.max(1, (today.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
        const estimatedTax = (ytdNetInr / monthsElapsed) * 12 * ((deductions.taxSlabRate ?? 30) / 100);

        for (const reminder of activeReminders) {
          const dueDateStr = reminder.dueDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
          const { subject, html } = buildReminderEmail(reminder.daysUntil, reminder.label, estimatedTax * reminder.cumulativePct, dueDateStr);
          try {
            await sendEmail(user.email, subject, html);
            sent++;
          } catch (err) {
            console.error(`[CRON] Failed to email user ${user.id}:`, err);
            failed++;
          }
        }
      }

      return res.json({ sent, failed, usersProcessed: proUsers.length, remindersToday: activeReminders.length });
    } catch (error) {
      console.error("[CRON TAX REMINDERS] Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── TDS Entries ───────────────────────────────────────────────────────────
  app.get("/api/tds-entries", requireAuth, requirePro, async (req, res) => {
    try {
      const entries = await storage.getTdsEntries(req.session.userId!);
      res.json(entries);
    } catch (error) {
      console.error("[TDS GET] Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/tds-entries", requireAuth, requirePro, async (req, res) => {
    try {
      const validated = insertTdsEntrySchema.parse(req.body);
      const entry = await storage.createTdsEntry(validated, req.session.userId!);
      res.status(201).json(entry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        console.error("[TDS POST] Error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.delete("/api/tds-entries/:id", requireAuth, requirePro, async (req, res) => {
    try {
      await storage.deleteTdsEntry(req.params.id, req.session.userId!);
      res.status(204).send();
    } catch (error) {
      console.error("[TDS DELETE] Error:", error);
      res.status(500).json({ message: "Internal server error" });
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
      if (!["pending", "received"].includes(paymentStatus)) {
        return res.status(400).json({ message: "paymentStatus must be 'pending' or 'received'" });
      }

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
  app.post("/api/withdrawals/import", requireAuth, requirePro, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const { csv } = req.body as { csv: string };
      if (!csv || typeof csv !== "string")
        return res.status(400).json({ message: "No CSV content provided" });

      const records = parseCsv(csv.trim());
      if (records.length < 2) return res.status(400).json({ message: "CSV must have a header and at least one row" });
      if (records.length - 1 > MAX_CSV_ROWS)
        return res.status(413).json({ message: `Too many rows (max ${MAX_CSV_ROWS}). Split the file and import in batches.` });

      const headers = records[0].map(h => h.trim().toLowerCase().replace(/"/g, ""));
      if (!headers.includes("date") || !headers.includes("amount"))
        return res.status(400).json({ message: "Missing required columns: date, amount" });

      const imported: string[] = [];
      const failed: { row: number; reason: string }[] = [];

      for (let i = 1; i < records.length; i++) {
        const values = records[i];
        if (values.every(v => !v.trim())) continue;

        const row: Record<string, string> = {};
        headers.forEach((h, idx) => { row[h] = (values[idx] ?? "").trim(); });

        const dateVal = parseCsvDate(row.date);
        if (!dateVal) { failed.push({ row: i, reason: `Invalid date: "${row.date}"` }); continue; }

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

      res.json({ imported: imported.length, failed, total: records.length - 1 });
    } catch (error) {
      console.error("[WITHDRAWALS IMPORT] Error:", error);
      res.status(500).json({ message: "Import failed" });
    }
  });

  // ── Catch-all (production) ────────────────────────────────────────────────
  registerSubscriptionRoutes(app);

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
