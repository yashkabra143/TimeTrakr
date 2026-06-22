import { type Server } from "node:http";

import express, { type Express, type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import helmet from "helmet";
import pg from "pg";
import { registerRoutes } from "./routes.js";

// ── Session type augmentation ─────────────────────────────────────────────
declare module "express-session" {
  interface SessionData {
    userId: string;
    oauthState?: string;
    user: {
      id: string;
      username: string;
      email?: string | null;
      fullName?: string | null;
      dateOfBirth?: string | null;
      profilePicture?: string | null;
      planType: string;
      planExpiresAt: string | null;
    };
  }
}

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

const isProduction = process.env.NODE_ENV === "production";

export const app = express();

// Trust proxy — important for Vercel / secure cookies behind reverse proxy
app.set("trust proxy", 1);

// ── Security headers (Helmet) ──────────────────────────────────────────────
// CSP is delivered via a <meta> tag in client/index.html, so we disable
// Helmet's CSP here to avoid conflicting policies. Everything else (HSTS,
// X-Content-Type-Options, frameguard, referrer policy, etc.) stays on.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    hsts: isProduction
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
  })
);

// ── CSRF / cross-site request blocking ─────────────────────────────────────
// Extra origins explicitly trusted beyond same-origin (rarely needed).
const EXTRA_ALLOWED_ORIGINS = new Set<string>(
  [process.env.APP_URL].filter((o): o is string => Boolean(o))
);

// Block state-changing requests whose Origin does not match the host the
// request arrived on (i.e. genuine cross-site requests). This is host-relative
// so it works across Vercel preview URLs, the production alias, and custom
// domains without per-environment config. Server-to-server callers (e.g. the
// Razorpay webhook) send no Origin and are allowed; SameSite=lax cookies are
// the primary CSRF defense, this is defense-in-depth.
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
app.use((req, res, next) => {
  if (!MUTATING_METHODS.has(req.method)) return next();
  const origin = req.headers.origin;
  if (!origin) return next(); // non-browser / same-origin form posts
  if (EXTRA_ALLOWED_ORIGINS.has(origin)) return next();
  try {
    if (new URL(origin).host === req.headers.host) return next();
  } catch { /* malformed Origin → fall through to block */ }
  return res.status(403).json({ message: "Cross-site request blocked" });
});

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// Cap request body size — protects against memory-exhaustion DoS while still
// allowing reasonably large CSV imports.
app.use(express.json({
  limit: "2mb",
  verify: (req, _res, buf) => { req.rawBody = buf; },
}));
app.use(express.urlencoded({ extended: false, limit: "2mb" }));

// ── Session middleware ─────────────────────────────────────────────────────
const PgStore = connectPgSimple(session);

// Use pg Pool (node-postgres) for session storage — works with Neon's connection string.
// Verify TLS certificates in production (Neon presents a publicly-trusted cert).
const pgPool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: true } : false,
  max: 3,
});

// SESSION_SECRET must be set in production — without it, sessions are forgeable.
const sessionSecret = process.env.SESSION_SECRET;
if (isProduction && !sessionSecret) {
  throw new Error("SESSION_SECRET environment variable is required in production");
}

app.use(
  session({
    store: new PgStore({
      pool: pgPool,
      createTableIfMissing: true, // auto-creates "session" table in Neon
      tableName: "session",
    }),
    secret: sessionSecret || "timeflow-dev-secret-not-for-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isProduction,
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      sameSite: "lax",
    },
  })
);


export default async function runApp(
  setup: (app: Express, server: Server | null) => Promise<void>,
) {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("[APP ERROR]", err);
    if (!res.headersSent) {
      res.status(status).json({ message });
    }
  });

  await setup(app, server);

  if (server) {
    const port = parseInt(process.env.PORT || "5000", 10);
    server.listen({ port, host: "127.0.0.1" }, () => {
      log(`serving on port ${port}`);
    });
  } else {
    log("Running in serverless mode - no server to start");
  }
}
