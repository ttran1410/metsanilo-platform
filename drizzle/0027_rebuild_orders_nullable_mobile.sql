PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `orders_rg_temp` (
	`id` text PRIMARY KEY NOT NULL,
	`shop_id` text NOT NULL REFERENCES `shops`(`id`),
	`public_reference` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`product_id` text NOT NULL REFERENCES `products`(`id`),
	`package_id` text NOT NULL REFERENCES `packages`(`id`),
	`customer_id` text REFERENCES `customers`(`id`),
	`product_name_fi` text NOT NULL,
	`product_name_en` text NOT NULL,
	`package_label_fi` text NOT NULL,
	`package_label_en` text NOT NULL,
	`quantity` integer NOT NULL,
	`volume_ml` integer NOT NULL,
	`item_subtotal_cents` integer NOT NULL,
	`delivery_fee_cents` integer,
	`final_total_cents` integer,
	`fulfillment_date` text NOT NULL,
	`fulfillment_method` text NOT NULL,
	`customer_name` text NOT NULL,
	`mobile` text,
	`email` text,
	`street_address` text,
	`postal_code` text,
	`city` text,
	`pickup_name` text,
	`pickup_address` text,
	`pickup_instructions` text,
	`pickup_time` text,
	`pickup_location_snapshot_json` text,
	`delivery_origin_snapshot_json` text,
	`notes` text,
	`facebook_profile` text,
	`order_source` text DEFAULT 'WEBSITE' NOT NULL,
	`historical_entry` integer DEFAULT false NOT NULL,
	`status_reason` text,
	`contacted_at` text,
	`contacted_by` text,
	`contact_channel` text,
	`fulfillment_started_at` text,
	`ready_at` text,
	`dispatched_at` text,
	`completed_at` text,
	`pickup_confirmed_at` text,
	`pickup_confirmed_by` text,
	`locale` text NOT NULL,
	`status` text DEFAULT 'NEW' NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`archived_at` text,
	`archived_by` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `orders_rg_temp` SELECT `id`, `shop_id`, `public_reference`, `idempotency_key`, `product_id`, `package_id`, `customer_id`, `product_name_fi`, `product_name_en`, `package_label_fi`, `package_label_en`, `quantity`, `volume_ml`, `item_subtotal_cents`, `delivery_fee_cents`, `final_total_cents`, `fulfillment_date`, `fulfillment_method`, `customer_name`, `mobile`, `email`, `street_address`, `postal_code`, `city`, `pickup_name`, `pickup_address`, `pickup_instructions`, `pickup_time`, `pickup_location_snapshot_json`, `delivery_origin_snapshot_json`, `notes`, `facebook_profile`, `order_source`, `historical_entry`, `status_reason`, `contacted_at`, `contacted_by`, `contact_channel`, `fulfillment_started_at`, `ready_at`, `dispatched_at`, `completed_at`, `pickup_confirmed_at`, `pickup_confirmed_by`, `locale`, `status`, `archived`, `archived_at`, `archived_by`, `version`, `created_at`, `updated_at` FROM `orders`;
--> statement-breakpoint
DROP TABLE `orders`;
--> statement-breakpoint
ALTER TABLE `orders_rg_temp` RENAME TO `orders`;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `orders_shop_reference_unique` ON `orders` (`shop_id`,`public_reference`);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `orders_shop_idempotency_unique` ON `orders` (`shop_id`,`idempotency_key`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `orders_shop_created_idx` ON `orders` (`shop_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `orders_shop_archived_idx` ON `orders` (`shop_id`,`archived`);
--> statement-breakpoint
PRAGMA foreign_keys=ON;
