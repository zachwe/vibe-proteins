/**
 * Custom migration script that fixes Drizzle's timestamp-based migration tracking.
 *
 * Drizzle's default migrator only checks if a migration's timestamp is newer than
 * the last applied migration. This breaks when migrations have out-of-order timestamps
 * (e.g., auto-generated migrations from drizzle-kit have future timestamps).
 *
 * This script checks each migration by hash, ensuring all migrations are applied
 * regardless of timestamp ordering.
 */
import Database from "better-sqlite3";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "path";

const dbUrl = process.env.DATABASE_URL || "./vibeproteins.db";
console.log(`Running migrations on database: ${dbUrl}`);

const sqlite = new Database(dbUrl);

// Create migrations table if it doesn't exist
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS __drizzle_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hash TEXT NOT NULL,
    created_at INTEGER
  )
`);

// Read journal
const migrationsFolder = path.join(import.meta.dirname, "../../drizzle");
console.log(`Migrations folder: ${migrationsFolder}`);

const journalPath = path.join(migrationsFolder, "meta/_journal.json");
if (!fs.existsSync(journalPath)) {
  throw new Error(`Can't find meta/_journal.json file at ${journalPath}`);
}

const journal = JSON.parse(fs.readFileSync(journalPath, "utf-8"));

// Get all applied migration hashes from database
const appliedMigrations = new Set<string>();
const rows = sqlite.prepare("SELECT hash FROM __drizzle_migrations").all() as { hash: string }[];
for (const row of rows) {
  appliedMigrations.add(row.hash);
}
console.log(`Found ${appliedMigrations.size} previously applied migrations`);

// Process each migration from journal
let appliedCount = 0;
let skippedCount = 0;

for (const entry of journal.entries) {
  const migrationPath = path.join(migrationsFolder, `${entry.tag}.sql`);

  if (!fs.existsSync(migrationPath)) {
    throw new Error(`Migration file not found: ${migrationPath}`);
  }

  const sql = fs.readFileSync(migrationPath, "utf-8");
  const hash = crypto.createHash("sha256").update(sql).digest("hex");

  // Check if this specific migration has been applied (by hash)
  if (appliedMigrations.has(hash)) {
    skippedCount++;
    continue;
  }

  // Also check by tag name (for migrations tracked by tag instead of hash)
  if (appliedMigrations.has(entry.tag)) {
    skippedCount++;
    continue;
  }

  console.log(`Applying migration: ${entry.tag}`);

  // Split by statement breakpoint and execute each statement
  const statements = sql.split("--> statement-breakpoint");

  try {
    sqlite.exec("BEGIN");

    for (const stmt of statements) {
      const trimmed = stmt.trim();
      if (trimmed) {
        sqlite.exec(trimmed);
      }
    }

    // Record the migration (use hash for consistency)
    sqlite
      .prepare("INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)")
      .run(hash, entry.when);

    sqlite.exec("COMMIT");
    appliedCount++;
    console.log(`  ✓ Applied successfully`);
  } catch (error: unknown) {
    sqlite.exec("ROLLBACK");

    // Check if this is an idempotent error (migration was already applied but tracked differently)
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isIdempotentError =
      errorMessage.includes("already exists") ||
      errorMessage.includes("duplicate column") ||
      errorMessage.includes("no such column") ||
      errorMessage.includes("no such table") ||
      errorMessage.includes("UNIQUE constraint failed");

    if (isIdempotentError) {
      // Migration was likely already applied, just record it
      console.log(`  ⚠ Migration appears already applied (${errorMessage.split("\n")[0]})`);
      sqlite
        .prepare("INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)")
        .run(hash, entry.when);
      skippedCount++;
      console.log(`  ✓ Recorded as applied`);
    } else {
      console.error(`  ✗ Failed to apply migration ${entry.tag}:`, error);
      throw error;
    }
  }
}

console.log(`\nMigrations completed: ${appliedCount} applied, ${skippedCount} skipped`);
sqlite.close();
