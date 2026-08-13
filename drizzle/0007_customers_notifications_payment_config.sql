CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`shop_id` text NOT NULL REFERENCES `shops`(`id`),
	`name` text NOT NULL,
	`mobile` text NOT NULL,
	`email` text,
	`match_status` text DEFAULT 'ACTIVE' NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `customers_shop_mobile_idx` ON `customers` (`shop_id`,`mobile`);
--> statement-breakpoint
CREATE INDEX `customers_shop_email_idx` ON `customers` (`shop_id`,`email`);
--> statement-breakpoint
ALTER TABLE `orders` ADD `customer_id` text REFERENCES `customers`(`id`);
--> statement-breakpoint
CREATE TABLE `shop_payment_methods` (
	`id` text PRIMARY KEY NOT NULL,
	`shop_id` text NOT NULL REFERENCES `shops`(`id`),
	`method` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shop_payment_methods_unique` ON `shop_payment_methods` (`shop_id`,`method`);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`shop_id` text NOT NULL REFERENCES `shops`(`id`),
	`event_key` text NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`order_id` text,
	`read_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notifications_shop_event_unique` ON `notifications` (`shop_id`,`event_key`);
--> statement-breakpoint
CREATE INDEX `notifications_shop_read_idx` ON `notifications` (`shop_id`,`read_at`,`created_at`);
