-- Organization table (BetterAuth organization plugin + billing extension)
CREATE TABLE `organization` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `name` TEXT NOT NULL,
  `slug` TEXT NOT NULL UNIQUE,
  `logo` TEXT,
  `metadata` TEXT,
  `created_at` INTEGER NOT NULL,
  `balance_usd_cents` INTEGER NOT NULL DEFAULT 0,
  `stripe_customer_id` TEXT
);
--> statement-breakpoint
-- Member table (organization membership)
CREATE TABLE `member` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `user_id` TEXT NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
  `organization_id` TEXT NOT NULL REFERENCES `organization`(`id`) ON DELETE CASCADE,
  `role` TEXT NOT NULL,
  `created_at` INTEGER NOT NULL
);
--> statement-breakpoint
-- Invitation table (pending invites)
CREATE TABLE `invitation` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `email` TEXT NOT NULL,
  `inviter_id` TEXT NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
  `organization_id` TEXT NOT NULL REFERENCES `organization`(`id`) ON DELETE CASCADE,
  `role` TEXT NOT NULL,
  `status` TEXT NOT NULL DEFAULT 'pending',
  `created_at` INTEGER NOT NULL,
  `expires_at` INTEGER NOT NULL
);
--> statement-breakpoint
-- Add activeOrganizationId to session
ALTER TABLE `session` ADD COLUMN `active_organization_id` TEXT REFERENCES `organization`(`id`);
--> statement-breakpoint
-- Indexes for efficient lookups
CREATE INDEX `idx_member_user_id` ON `member`(`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_member_organization_id` ON `member`(`organization_id`);
--> statement-breakpoint
CREATE INDEX `idx_invitation_organization_id` ON `invitation`(`organization_id`);
--> statement-breakpoint
CREATE INDEX `idx_invitation_email` ON `invitation`(`email`);
