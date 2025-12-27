-- Migration: Usage-based billing with GPU pricing
-- This replaces the credit system with USD balance and per-second GPU charging

-- Rename credits to balance_usd_cents in user table
ALTER TABLE user RENAME COLUMN credits TO balance_usd_cents;--> statement-breakpoint
-- Add usage tracking columns to jobs table
ALTER TABLE jobs ADD COLUMN gpu_type TEXT;--> statement-breakpoint
ALTER TABLE jobs ADD COLUMN execution_seconds REAL;--> statement-breakpoint
ALTER TABLE jobs ADD COLUMN cost_usd_cents INTEGER;--> statement-breakpoint
-- Create new transactions table (replacing credit_transactions)
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`type` text NOT NULL,
	`job_id` text,
	`stripe_session_id` text,
	`description` text,
	`balance_after_cents` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
-- Create GPU pricing table
CREATE TABLE `gpu_pricing` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`modal_rate_per_sec` real NOT NULL,
	`markup_percent` real DEFAULT 30 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);--> statement-breakpoint
-- Create deposit presets table
CREATE TABLE `deposit_presets` (
	`id` text PRIMARY KEY NOT NULL,
	`amount_cents` integer NOT NULL,
	`label` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);--> statement-breakpoint
-- Drop old tables (credit_packages may not exist in some envs)
DROP TABLE IF EXISTS credit_transactions;--> statement-breakpoint
DROP TABLE IF EXISTS credit_packages;
