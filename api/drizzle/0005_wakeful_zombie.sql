CREATE TABLE `credit_packages` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`credits` integer NOT NULL,
	`price_usd_cents` integer NOT NULL,
	`bonus_credits` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `credit_transactions` ADD `stripe_session_id` text;--> statement-breakpoint
ALTER TABLE `credit_transactions` ADD `balance_after` integer;--> statement-breakpoint
ALTER TABLE `user` ADD `stripe_customer_id` text;