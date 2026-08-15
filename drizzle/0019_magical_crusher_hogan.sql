CREATE TABLE `fulfillment_locations` (
	`id` text PRIMARY KEY NOT NULL,
	`shop_id` text NOT NULL,
	`type` text NOT NULL,
	`name_fi` text NOT NULL,
	`name_en` text NOT NULL,
	`address` text NOT NULL,
	`instructions_fi` text DEFAULT '' NOT NULL,
	`instructions_en` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `fulfillment_locations_shop_type_idx` ON `fulfillment_locations` (`shop_id`,`type`,`active`);--> statement-breakpoint
CREATE TABLE `order_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`shop_id` text NOT NULL,
	`key` text NOT NULL,
	`label_fi` text NOT NULL,
	`label_en` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `order_sources_shop_key_unique` ON `order_sources` (`shop_id`,`key`);--> statement-breakpoint
CREATE INDEX `order_sources_shop_active_idx` ON `order_sources` (`shop_id`,`active`,`sort_order`);