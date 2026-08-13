CREATE TABLE `audit_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`shop_id` text NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`details_json` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_shop_created_idx` ON `audit_entries` (`shop_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `availability` (
	`id` text PRIMARY KEY NOT NULL,
	`shop_id` text NOT NULL,
	`product_id` text NOT NULL,
	`business_date` text NOT NULL,
	`capacity_ml` integer NOT NULL,
	`reserved_ml` integer DEFAULT 0 NOT NULL,
	`accepts_orders` integer DEFAULT true NOT NULL,
	`manual_sold_out` integer DEFAULT false NOT NULL,
	`manual_sold_out_reason` text,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "availability_nonnegative_capacity" CHECK("availability"."capacity_ml" >= 0),
	CONSTRAINT "availability_reserved_in_range" CHECK("availability"."reserved_ml" >= 0 AND "availability"."reserved_ml" <= "availability"."capacity_ml")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `availability_shop_product_date_unique` ON `availability` (`shop_id`,`product_id`,`business_date`);--> statement-breakpoint
CREATE INDEX `availability_shop_date_idx` ON `availability` (`shop_id`,`business_date`);--> statement-breakpoint
CREATE TABLE `orders` (
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
	`mobile` text NOT NULL,
	`email` text,
	`street_address` text,
	`postal_code` text,
	`city` text,
	`pickup_name` text,
	`pickup_address` text,
	`pickup_instructions` text,
	`pickup_time` text,
	`notes` text,
	`locale` text NOT NULL,
	`status` text DEFAULT 'NEW' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`package_id`) REFERENCES `packages`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "orders_public_quantity_one" CHECK("orders"."quantity" = 1),
	CONSTRAINT "orders_positive_volume" CHECK("orders"."volume_ml" > 0),
	CONSTRAINT "orders_nonnegative_subtotal" CHECK("orders"."item_subtotal_cents" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_shop_reference_unique` ON `orders` (`shop_id`,`public_reference`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_shop_idempotency_unique` ON `orders` (`shop_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `orders_shop_created_idx` ON `orders` (`shop_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `packages` (
	`id` text PRIMARY KEY NOT NULL,
	`shop_id` text NOT NULL,
	`product_id` text NOT NULL,
	`label_fi` text NOT NULL,
	`label_en` text NOT NULL,
	`volume_ml` integer NOT NULL,
	`price_cents` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "packages_positive_volume" CHECK("packages"."volume_ml" > 0),
	CONSTRAINT "packages_nonnegative_price" CHECK("packages"."price_cents" >= 0)
);
--> statement-breakpoint
CREATE INDEX `packages_shop_product_idx` ON `packages` (`shop_id`,`product_id`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`shop_id` text NOT NULL,
	`code` text NOT NULL,
	`slug` text NOT NULL,
	`name_fi` text NOT NULL,
	`name_en` text NOT NULL,
	`available_from` text NOT NULL,
	`available_through` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "products_valid_window" CHECK("products"."available_from" <= "products"."available_through")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_shop_code_unique` ON `products` (`shop_id`,`code`);--> statement-breakpoint
CREATE TABLE `shops` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name_fi` text NOT NULL,
	`name_en` text NOT NULL,
	`timezone` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`pickup_name_fi` text NOT NULL,
	`pickup_name_en` text NOT NULL,
	`pickup_address` text NOT NULL,
	`pickup_instructions_fi` text NOT NULL,
	`pickup_instructions_en` text NOT NULL,
	`pickup_time` text DEFAULT '20:00' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shops_slug_unique` ON `shops` (`slug`);