import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as authSchema from "./db/auth-schema";

const DATABASE_PATH = process.env.DATABASE_URL || "vibeproteins.db";

// Create a separate connection for BetterAuth
const sqlite = new Database(DATABASE_PATH);
const db = drizzle(sqlite, { schema: authSchema });

// Trusted origins based on environment
const trustedOrigins =
  process.env.NODE_ENV === "production"
    ? ["https://vibe-proteins.zachocean.com"]
    : ["http://localhost:5173"];

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: authSchema,
  }),
  basePath: "/api/auth",
  emailAndPassword: {
    enabled: true,
  },
  // Session configuration
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  trustedOrigins,
  // Secret is read from BETTER_AUTH_SECRET env var automatically
  // You can add more providers here later (Google, GitHub, etc.)
});
