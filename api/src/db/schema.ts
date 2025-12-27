import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { user } from "./auth-schema";

// Re-export user from auth-schema so it's available from this module too
export { user } from "./auth-schema";

// Challenges table
export const challenges = sqliteTable("challenges", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  mission: text("mission"), // Simple, inspiring mission statement for non-experts
  difficulty: integer("difficulty").notNull(), // 1-5
  level: integer("level").notNull(), // 1-4 (curriculum level)
  targetPdbId: text("target_pdb_id"), // PDB ID if available
  targetUniprotId: text("target_uniprot_id"), // UniProt ID if available
  targetStructureUrl: text("target_structure_url"), // S3 URL to structure file
  targetSequence: text("target_sequence"),
  targetChainId: text("target_chain_id"), // Which chain in the PDB is the actual target
  pdbDescription: text("pdb_description"), // What this PDB structure shows
  chainAnnotations: text("chain_annotations"), // JSON: { "E": { "name": "Spike RBD", "role": "target" }, ... }
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
  type: text("type").notNull(), // 'rfdiffusion3', 'boltz2', 'alphafold', etc.
  status: text("status").notNull().default("pending"), // 'pending', 'running', 'completed', 'failed'
  input: text("input"), // JSON input parameters
  output: text("output"), // JSON output or S3 URL
  // Usage tracking (populated on completion)
  gpuType: text("gpu_type"), // e.g., 'A10G', 'A100_40GB', etc.
  executionSeconds: real("execution_seconds"), // Actual GPU time used
  costUsdCents: integer("cost_usd_cents"), // Calculated cost in cents
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

// Transactions (balance changes in USD cents)
export const transactions = sqliteTable("transactions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  amountCents: integer("amount_cents").notNull(), // Positive for deposits, negative for usage
  type: text("type").notNull(), // 'deposit', 'job_usage', 'refund'
  jobId: text("job_id").references(() => jobs.id),
  stripeSessionId: text("stripe_session_id"), // For deposit transactions
  description: text("description"),
  balanceAfterCents: integer("balance_after_cents"), // User's balance after this transaction
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// GPU pricing (Modal rates + markup, per second)
export const gpuPricing = sqliteTable("gpu_pricing", {
  id: text("id").primaryKey(), // e.g., 'A10G', 'A100_40GB', 'H100'
  name: text("name").notNull(), // Display name e.g., "NVIDIA A10G"
  modalRatePerSec: real("modal_rate_per_sec").notNull(), // Modal's rate in USD
  markupPercent: real("markup_percent").notNull().default(30), // Our markup (default 30%)
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Preset deposit amounts (for quick "Add $X" buttons)
export const depositPresets = sqliteTable("deposit_presets", {
  id: text("id").primaryKey(),
  amountCents: integer("amount_cents").notNull(), // e.g., 500 = $5.00
  label: text("label").notNull(), // e.g., "$5"
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
