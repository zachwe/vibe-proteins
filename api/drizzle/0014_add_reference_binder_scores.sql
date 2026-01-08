-- Add additional scoring columns to reference_binders table
ALTER TABLE `reference_binders` ADD COLUMN `iptm` real;
--> statement-breakpoint
ALTER TABLE `reference_binders` ADD COLUMN `pdockq` real;
--> statement-breakpoint
ALTER TABLE `reference_binders` ADD COLUMN `pdockq2` real;
--> statement-breakpoint
ALTER TABLE `reference_binders` ADD COLUMN `lis` real;
