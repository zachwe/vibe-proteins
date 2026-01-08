-- Reference binders table (known therapeutic/research binders for leaderboard seeding)
CREATE TABLE `reference_binders` (
  `id` text PRIMARY KEY NOT NULL,
  `challenge_id` text NOT NULL REFERENCES `challenges`(`id`),
  `name` text NOT NULL,
  `slug` text NOT NULL,
  `binder_type` text NOT NULL,
  `pdb_id` text,
  `pdb_url` text,
  `binder_chain_id` text,
  `binder_sequence` text,
  `complex_structure_url` text,
  `composite_score` real,
  `ip_sae_score` real,
  `plddt` real,
  `ptm` real,
  `interface_area` real,
  `shape_complementarity` real,
  `help_article_slug` text,
  `short_description` text,
  `discovery_year` integer,
  `approval_status` text,
  `is_active` integer DEFAULT 1 NOT NULL,
  `sort_order` integer DEFAULT 0 NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
-- Help articles table (educational content for reference binders and concepts)
CREATE TABLE `help_articles` (
  `slug` text PRIMARY KEY NOT NULL,
  `title` text NOT NULL,
  `content` text NOT NULL,
  `category` text NOT NULL,
  `related_challenges` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
-- Index for faster lookups
CREATE INDEX `reference_binders_challenge_idx` ON `reference_binders`(`challenge_id`);
--> statement-breakpoint
CREATE INDEX `help_articles_category_idx` ON `help_articles`(`category`);
