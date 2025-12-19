import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import * as authSchema from "./auth-schema";

const sqlite = new Database("vibeproteins.db");
export const db = drizzle(sqlite, { schema: { ...schema, ...authSchema } });

export * from "./schema";
export * from "./auth-schema";
