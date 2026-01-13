-- Add admin plugin fields to user table
ALTER TABLE `user` ADD COLUMN `role` text DEFAULT 'user';
--> statement-breakpoint
ALTER TABLE `user` ADD COLUMN `banned` integer DEFAULT false;
--> statement-breakpoint
ALTER TABLE `user` ADD COLUMN `ban_reason` text;
--> statement-breakpoint
ALTER TABLE `user` ADD COLUMN `ban_expires` integer;
--> statement-breakpoint
-- Add impersonation tracking to session table
ALTER TABLE `session` ADD COLUMN `impersonated_by` text;
