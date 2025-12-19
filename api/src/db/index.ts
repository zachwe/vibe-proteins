import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import * as authSchema from "./auth-schema";

export const DATABASE_PATH = process.env.DATABASE_URL || "vibeproteins.db";

const sqlite = new Database(DATABASE_PATH);
export const db = drizzle(sqlite, { schema: { ...schema, ...authSchema } });

export * from "./schema";
export * from "./auth-schema";
