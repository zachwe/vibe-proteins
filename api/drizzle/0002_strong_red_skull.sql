DROP TABLE `users`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_credit_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`amount` integer NOT NULL,
	`type` text NOT NULL,
	`job_id` text,
	`description` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_credit_transactions`("id", "user_id", "amount", "type", "job_id", "description", "created_at") SELECT "id", "user_id", "amount", "type", "job_id", "description", "created_at" FROM `credit_transactions`;--> statement-breakpoint
DROP TABLE `credit_transactions`;--> statement-breakpoint
ALTER TABLE `__new_credit_transactions` RENAME TO `credit_transactions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`challenge_id` text NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`input` text,
	`output` text,
	`credits_used` integer DEFAULT 0 NOT NULL,
	`error` text,
	`created_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`challenge_id`) REFERENCES `challenges`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_jobs`("id", "user_id", "challenge_id", "type", "status", "input", "output", "credits_used", "error", "created_at", "completed_at") SELECT "id", "user_id", "challenge_id", "type", "status", "input", "output", "credits_used", "error", "created_at", "completed_at" FROM `jobs`;--> statement-breakpoint
DROP TABLE `jobs`;--> statement-breakpoint
ALTER TABLE `__new_jobs` RENAME TO `jobs`;--> statement-breakpoint
CREATE TABLE `__new_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`challenge_id` text NOT NULL,
	`job_id` text,
	`design_sequence` text NOT NULL,
	`design_structure_url` text,
	`composite_score` real,
	`ip_sae_score` real,
	`plddt` real,
	`ptm` real,
	`interface_area` real,
	`shape_complementarity` real,
	`feedback` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`challenge_id`) REFERENCES `challenges`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_submissions`("id", "user_id", "challenge_id", "job_id", "design_sequence", "design_structure_url", "composite_score", "ip_sae_score", "plddt", "ptm", "interface_area", "shape_complementarity", "feedback", "created_at") SELECT "id", "user_id", "challenge_id", "job_id", "design_sequence", "design_structure_url", "composite_score", "ip_sae_score", "plddt", "ptm", "interface_area", "shape_complementarity", "feedback", "created_at" FROM `submissions`;--> statement-breakpoint
DROP TABLE `submissions`;--> statement-breakpoint
ALTER TABLE `__new_submissions` RENAME TO `submissions`;