import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "path";

const dbUrl = process.env.DATABASE_URL || "./vibeproteins.db";
console.log(`Running migrations on database: ${dbUrl}`);

const sqlite = new Database(dbUrl);
const db = drizzle(sqlite);

// Run migrations from the drizzle folder
const migrationsFolder = path.join(import.meta.dirname, "../../drizzle");
console.log(`Migrations folder: ${migrationsFolder}`);

migrate(db, { migrationsFolder });

console.log("Migrations completed successfully");
sqlite.close();
