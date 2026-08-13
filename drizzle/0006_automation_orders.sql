ALTER TABLE `orders` ADD `order_source` text DEFAULT 'WEBSITE' NOT NULL;
--> statement-breakpoint
ALTER TABLE `orders` ADD `historical_entry` integer DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE `order_payments` ADD `kind` text DEFAULT 'PAYMENT' NOT NULL;
--> statement-breakpoint
CREATE TABLE `outbox_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`shop_id` text NOT NULL REFERENCES `shops`(`id`),
	`event_key` text NOT NULL,
	`type` text NOT NULL,
	`payload_json` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`scheduled_for` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`processed_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `outbox_shop_event_unique` ON `outbox_jobs` (`shop_id`,`event_key`);
--> statement-breakpoint
CREATE INDEX `outbox_due_idx` ON `outbox_jobs` (`shop_id`,`status`,`scheduled_for`);
