ALTER TABLE `orders` ADD `pickup_confirmed_at` text;
--> statement-breakpoint
ALTER TABLE `orders` ADD `pickup_confirmed_by` text;
--> statement-breakpoint
CREATE TABLE `order_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`shop_id` text NOT NULL REFERENCES `shops`(`id`),
	`order_id` text NOT NULL REFERENCES `orders`(`id`),
	`body` text NOT NULL,
	`actor` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `order_notes_shop_order_idx` ON `order_notes` (`shop_id`,`order_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `order_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`shop_id` text NOT NULL REFERENCES `shops`(`id`),
	`order_id` text NOT NULL REFERENCES `orders`(`id`),
	`amount_cents` integer NOT NULL,
	`method` text NOT NULL,
	`reference` text,
	`recorded_at` text NOT NULL,
	`actor` text NOT NULL,
	CHECK (`amount_cents` > 0)
);
--> statement-breakpoint
CREATE INDEX `order_payments_shop_order_idx` ON `order_payments` (`shop_id`,`order_id`,`recorded_at`);
