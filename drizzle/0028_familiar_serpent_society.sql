ALTER TABLE `products` ADD `sort_order` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `products_shop_sort_idx` ON `products` (`shop_id`,`active`,`sort_order`);