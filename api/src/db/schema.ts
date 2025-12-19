import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { user } from "./auth-schema";

// Re-export user from auth-schema so it's available from this module too
export { user } from "./auth-schema";

// Challenges table
export const challenges = sqliteTable("challenges", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  difficulty: integer("difficulty").notNull(), // 1-5
  level: integer("level").notNull(), // 1-4 (curriculum level)
  targetPdbId: text("target_pdb_id"), // PDB ID if available
  targetStructureUrl: text("target_structure_url"), // S3 URL to structure file
  targetSequence: text("target_sequence"),
  taskType: text("task_type").notNull(), // 'binder', 'blocker', 'decoy', 'stabilizer'
  educationalContent: text("educational_content"), // Markdown content
  hints: text("hints"), // JSON array of hints
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Jobs table (for tracking inference jobs)
export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  challengeId: text("challenge_id")
    .notNull()
    .references(() => challenges.id),
  type: text("type").notNull(), // 'rfdiffusion', 'boltz2', 'alphafold', etc.
  status: text("status").notNull().default("pending"), // 'pending', 'running', 'completed', 'failed'
  input: text("input"), // JSON input parameters
  output: text("output"), // JSON output or S3 URL
  creditsUsed: integer("credits_used").notNull().default(0),
  error: text("error"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  completedAt: integer("completed_at", { mode: "timestamp" }),
});

// Submissions table
export const submissions = sqliteTable("submissions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  challengeId: text("challenge_id")
    .notNull()
    .references(() => challenges.id),
  jobId: text("job_id").references(() => jobs.id),
  designSequence: text("design_sequence").notNull(),
  designStructureUrl: text("design_structure_url"), // S3 URL
  // Scores
  compositeScore: real("composite_score"),
  ipSaeScore: real("ip_sae_score"),
  plddt: real("plddt"),
  ptm: real("ptm"),
  interfaceArea: real("interface_area"),
  shapeComplementarity: real("shape_complementarity"),
  // Feedback
  feedback: text("feedback"), // JSON or markdown feedback
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Credit transactions
export const creditTransactions = sqliteTable("credit_transactions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  amount: integer("amount").notNull(), // Positive for purchases, negative for usage
  type: text("type").notNull(), // 'signup_bonus', 'purchase', 'job_usage'
  jobId: text("job_id").references(() => jobs.id),
  description: text("description"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
