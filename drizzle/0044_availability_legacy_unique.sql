DROP INDEX `availability_shop_product_season_date_unique`;
--> statement-breakpoint
CREATE UNIQUE INDEX `availability_shop_product_season_date_unique`
ON `availability` (`shop_id`, `product_id`, `business_date`, `season_id`)
WHERE `season_id` IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `availability_shop_product_legacy_date_unique`
ON `availability` (`shop_id`, `product_id`, `business_date`)
WHERE `season_id` IS NULL;
