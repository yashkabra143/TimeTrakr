import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from "../shared/schema.js";

// Check for DATABASE_URL with better error message
if (!process.env.DATABASE_URL) {
  const error = new Error(
    "DATABASE_URL must be set. Did you forget to provision a database or set the environment variable in Vercel?",
  );
  console.error(error.message);
  throw error;
}

// Use Neon HTTP driver for serverless (Vercel-compatible)
// This uses fetch() instead of WebSockets or connection pooling
console.log("Database configured for serverless (Neon HTTP driver)");
console.log("Database connection initialized:", process.env.DATABASE_URL ? "✓ URL is set" : "✗ URL is missing");

// Create HTTP client
console.log("[DB] Initializing Neon client...");
const sql = neon(process.env.DATABASE_URL);

// Create drizzle instance with HTTP client
console.log("[DB] Initializing Drizzle...");
export const db = drizzle(sql, { schema, logger: true });
console.log("[DB] Drizzle initialized.");
