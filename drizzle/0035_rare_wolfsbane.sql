CREATE TABLE `storefront_theme_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`shop_id` text NOT NULL,
	`version` integer NOT NULL,
	`theme_key` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`published_by` text,
	`published_at` text,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `storefront_theme_versions_shop_version_unique` ON `storefront_theme_versions` (`shop_id`,`version`);--> statement-breakpoint
CREATE INDEX `storefront_theme_versions_shop_status_idx` ON `storefront_theme_versions` (`shop_id`,`status`,`updated_at`);--> statement-breakpoint
ALTER TABLE `shops` ADD `storefront_theme` text DEFAULT 'forest-harvest' NOT NULL;