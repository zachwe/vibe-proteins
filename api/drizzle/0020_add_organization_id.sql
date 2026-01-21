-- Add organizationId to jobs (nullable - null means personal job)
ALTER TABLE `jobs` ADD COLUMN `organization_id` TEXT REFERENCES `organization`(`id`);
--> statement-breakpoint
-- Add organizationId to submissions (nullable - null means personal submission)
ALTER TABLE `submissions` ADD COLUMN `organization_id` TEXT REFERENCES `organization`(`id`);
--> statement-breakpoint
-- Add organizationId to transactions for team billing history
ALTER TABLE `transactions` ADD COLUMN `organization_id` TEXT REFERENCES `organization`(`id`);
--> statement-breakpoint
-- Indexes for efficient team queries
CREATE INDEX `idx_jobs_organization_id` ON `jobs`(`organization_id`);
--> statement-breakpoint
CREATE INDEX `idx_submissions_organization_id` ON `submissions`(`organization_id`);
--> statement-breakpoint
CREATE INDEX `idx_transactions_organization_id` ON `transactions`(`organization_id`);
