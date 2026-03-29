import { type Server } from "node:http";

import express, { type Express, type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";
import { registerRoutes } from "./routes.js";

// ── Session type augmentation ─────────────────────────────────────────────
declare module "express-session" {
  interface SessionData {
    userId: string;
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

export const app = express();

// Trust proxy — important for Vercel / secure cookies behind reverse proxy
app.set("trust proxy", 1);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(express.json({
  verify: (req, _res, buf) => { req.rawBody = buf; },
}));
app.use(express.urlencoded({ extended: false }));

// ── Session middleware ─────────────────────────────────────────────────────
const PgStore = connectPgSimple(session);

// Use pg Pool (node-postgres) for session storage — works with Neon's connection string
const pgPool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  max: 3,
});

app.use(
  session({
    store: new PgStore({
      pool: pgPool,
      createTableIfMissing: true, // auto-creates "session" table in Neon
      tableName: "session",
    }),
    secret: process.env.SESSION_SECRET || "timeflow-dev-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      sameSite: "lax",
    },
  })
);

// ── Debug logging middleware ──────────────────────────────────────────────
app.use((req, _res, next) => {
  console.log(`[DEBUG] ${req.method} ${req.path}`, {
    sessionUserId: req.session?.userId ?? "none",
    body: req.body ? "has body" : "no body",
  });
  next();
});

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
