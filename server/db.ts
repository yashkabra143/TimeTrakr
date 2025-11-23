import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// Check for DATABASE_URL with better error message
if (!process.env.DATABASE_URL) {
  const error = new Error(
    "DATABASE_URL must be set. Did you forget to provision a database or set the environment variable in Vercel?",
  );
  console.error(error.message);
  throw error;
}

// Log database connection status (without exposing the URL)
console.log("Database connection initialized:", process.env.DATABASE_URL ? "✓ URL is set" : "✗ URL is missing");

export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  // Add connection pool settings for serverless
  max: 1, // Limit connections in serverless environment
});

export const db = drizzle({ client: pool, schema });
