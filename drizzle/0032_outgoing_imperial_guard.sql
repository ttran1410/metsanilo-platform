CREATE TABLE `harvest_seasons` (
	`id` text PRIMARY KEY NOT NULL,
	`shop_id` text NOT NULL,
	`product_id` text NOT NULL,
	`name_fi` text NOT NULL,
	`name_en` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`status` text DEFAULT 'UPCOMING' NOT NULL,
	`target_volume_ml` integer,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "harvest_seasons_valid_window" CHECK("harvest_seasons"."start_date" <= "harvest_seasons"."end_date")
);
--> statement-breakpoint
CREATE INDEX `harvest_seasons_shop_product_idx` ON `harvest_seasons` (`shop_id`,`product_id`,`start_date`);--> statement-breakpoint
ALTER TABLE `orders` ADD `season_id` text REFERENCES harvest_seasons(id);