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

export async function registerRoutes(app: Express): Promise<Server> {
  console.log("[ROUTES] Starting registration...");

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

  // Catch-all
  app.use("*", (req, res) => {
    console.log(`[404] Unhandled path: ${req.path}`);
    res.status(404).json({ error: "Not Found", path: req.path });
  });

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
