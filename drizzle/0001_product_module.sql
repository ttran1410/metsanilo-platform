ALTER TABLE `products` ADD `description_fi` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `products` ADD `description_en` text DEFAULT '' NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `products_shop_slug_unique` ON `products` (`shop_id`,`slug`);
