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
  pdbStartResidue: integer("pdb_start_residue"), // First residue number in PDB (e.g., 319 for spike)
  pdbDescription: text("pdb_description"), // What this PDB structure shows
  chainAnnotations: text("chain_annotations"), // JSON: { "E": { "name": "Spike RBD", "role": "target" }, ... }
  suggestedHotspots: text("suggested_hotspots"), // JSON: [{ "residues": ["E:417", "E:453"], "label": "ACE2 binding site", "description": "..." }]
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
  // Modal async tracking
  modalCallId: text("modal_call_id"), // Modal FunctionCall ID for async polling
  progress: text("progress"), // JSON array of progress events: [{stage, message, timestamp}]
  // Usage tracking (populated on completion, updated periodically for long jobs)
  gpuType: text("gpu_type"), // e.g., 'A10G', 'A100_40GB', etc.
  executionSeconds: real("execution_seconds"), // Actual GPU time used
  billedSeconds: real("billed_seconds").default(0), // Seconds already billed (for partial billing)
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
  // Status tracking
  status: text("status").notNull().default("pending"), // 'pending', 'running', 'completed', 'failed'
  error: text("error"),
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

// Reference binders (known therapeutic/research binders for leaderboard seeding)
export const referenceBinders = sqliteTable("reference_binders", {
  id: text("id").primaryKey(),
  challengeId: text("challenge_id")
    .notNull()
    .references(() => challenges.id),
  name: text("name").notNull(), // e.g., "Adalimumab (Humira)"
  slug: text("slug").notNull(), // URL-safe, e.g., "adalimumab"
  binderType: text("binder_type").notNull(), // 'antibody', 'nanobody', 'fusion_protein', 'designed', 'natural'
  // Structure data
  pdbId: text("pdb_id"), // e.g., "3WD5"
  pdbUrl: text("pdb_url"), // Full RCSB URL
  binderChainId: text("binder_chain_id"), // Which chain is the binder
  binderSequence: text("binder_sequence"),
  complexStructureUrl: text("complex_structure_url"), // S3 URL to processed structure
  // Scores (populated by running through scoring pipeline)
  compositeScore: real("composite_score"),
  ipSaeScore: real("ip_sae_score"),
  plddt: real("plddt"),
  ptm: real("ptm"),
  iptm: real("iptm"),
  pdockq: real("pdockq"),
  pdockq2: real("pdockq2"),
  lis: real("lis"),
  interfaceArea: real("interface_area"),
  shapeComplementarity: real("shape_complementarity"),
  // Educational content
  helpArticleSlug: text("help_article_slug"), // Link to help article
  shortDescription: text("short_description"), // One-liner for leaderboard
  scoringNote: text("scoring_note"), // Note about scoring limitations (shown as tooltip)
  // Metadata
  discoveryYear: integer("discovery_year"),
  approvalStatus: text("approval_status"), // 'fda_approved', 'clinical_trial', 'research_tool', 'de_novo_designed'
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Help articles (educational content)
export const helpArticles = sqliteTable("help_articles", {
  slug: text("slug").primaryKey(), // e.g., "adalimumab"
  title: text("title").notNull(),
  content: text("content").notNull(), // Full markdown content
  category: text("category").notNull(), // 'reference-binder', 'concept', 'tutorial'
  relatedChallenges: text("related_challenges"), // JSON array of challenge IDs
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
