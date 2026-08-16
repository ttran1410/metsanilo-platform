ALTER TABLE `orders` ADD `archived` integer DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE `orders` ADD `archived_at` text;
--> statement-breakpoint
ALTER TABLE `orders` ADD `archived_by` text;
--> statement-breakpoint
CREATE INDEX `orders_shop_archived_idx` ON `orders` (`shop_id`,`archived`);
