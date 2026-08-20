DROP INDEX `availability_shop_product_date_unique`;--> statement-breakpoint
ALTER TABLE `availability` ADD `season_id` text REFERENCES harvest_seasons(id);--> statement-breakpoint
UPDATE `availability`
SET `season_id` = (
  SELECT `harvest_seasons`.`id`
  FROM `harvest_seasons`
  WHERE `harvest_seasons`.`shop_id` = `availability`.`shop_id`
    AND `harvest_seasons`.`product_id` = `availability`.`product_id`
    AND `harvest_seasons`.`start_date` <= `availability`.`business_date`
    AND `harvest_seasons`.`end_date` >= `availability`.`business_date`
  ORDER BY CASE `harvest_seasons`.`status` WHEN 'ACTIVE' THEN 0 WHEN 'UPCOMING' THEN 1 ELSE 2 END, `harvest_seasons`.`start_date` DESC
  LIMIT 1
)
WHERE `availability`.`season_id` IS NULL;--> statement-breakpoint
UPDATE `orders`
SET `season_id` = (
  SELECT `harvest_seasons`.`id`
  FROM `harvest_seasons`
  WHERE `harvest_seasons`.`shop_id` = `orders`.`shop_id`
    AND `harvest_seasons`.`product_id` = `orders`.`product_id`
    AND `harvest_seasons`.`start_date` <= `orders`.`fulfillment_date`
    AND `harvest_seasons`.`end_date` >= `orders`.`fulfillment_date`
  ORDER BY CASE `harvest_seasons`.`status` WHEN 'ACTIVE' THEN 0 WHEN 'UPCOMING' THEN 1 ELSE 2 END, `harvest_seasons`.`start_date` DESC
  LIMIT 1
)
WHERE `orders`.`season_id` IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `availability_shop_product_season_date_unique` ON `availability` (`shop_id`,`product_id`,`season_id`,`business_date`);
