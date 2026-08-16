PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `orders_new` (
	`id` text PRIMARY KEY NOT NULL,
	`shop_id` text NOT NULL,
	`public_reference` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`product_id` text NOT NULL,
	`package_id` text NOT NULL,
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
	`notes` text,
	`pickup_confirmed_at` text,
	`pickup_confirmed_by` text,
	`locale` text NOT NULL,
	`status` text DEFAULT 'NEW' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`),
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`),
	FOREIGN KEY (`package_id`) REFERENCES `packages`(`id`),
	CONSTRAINT "orders_positive_quantity" CHECK("orders_new"."quantity" > 0),
	CONSTRAINT "orders_positive_volume" CHECK("orders_new"."volume_ml" > 0),
	CONSTRAINT "orders_nonnegative_subtotal" CHECK("orders_new"."item_subtotal_cents" >= 0)
);
--> statement-breakpoint
INSERT INTO `orders_new` SELECT `id`,`shop_id`,`public_reference`,`idempotency_key`,`product_id`,`package_id`,`product_name_fi`,`product_name_en`,`package_label_fi`,`package_label_en`,`quantity`,`volume_ml`,`item_subtotal_cents`,`delivery_fee_cents`,`final_total_cents`,`fulfillment_date`,`fulfillment_method`,`customer_name`,`mobile`,`email`,`street_address`,`postal_code`,`city`,`pickup_name`,`pickup_address`,`pickup_instructions`,`pickup_time`,`notes`,`pickup_confirmed_at`,`pickup_confirmed_by`,`locale`,`status`,`version`,`created_at`,`updated_at` FROM `orders`;
--> statement-breakpoint
DROP TABLE `orders`;
--> statement-breakpoint
ALTER TABLE `orders_new` RENAME TO `orders`;
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_shop_reference_unique` ON `orders` (`shop_id`,`public_reference`);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_shop_idempotency_unique` ON `orders` (`shop_id`,`idempotency_key`);
--> statement-breakpoint
CREATE INDEX `orders_shop_created_idx` ON `orders` (`shop_id`,`created_at`);
--> statement-breakpoint
PRAGMA foreign_keys=ON;
