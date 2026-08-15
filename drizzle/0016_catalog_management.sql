ALTER TABLE `products` ADD `show_on_homepage` integer DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE `products` ADD `show_on_reserve` integer DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE `packages` ADD `sort_order` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `packages` ADD `is_default` integer DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE `packages` SET `is_default` = 1 WHERE `id` IN (
  SELECT MIN(p.`id`) FROM `packages` p
  WHERE p.`volume_ml` = 10000
  GROUP BY p.`shop_id`, p.`product_id`
);
--> statement-breakpoint
UPDATE `packages` SET `is_default` = 1 WHERE `id` IN (
  SELECT MIN(p.`id`) FROM `packages` p
  WHERE NOT EXISTS (
    SELECT 1 FROM `packages` chosen
    WHERE chosen.`shop_id` = p.`shop_id` AND chosen.`product_id` = p.`product_id` AND chosen.`is_default` = 1
  )
  AND p.`volume_ml` = (
    SELECT MAX(largest.`volume_ml`) FROM `packages` largest
    WHERE largest.`shop_id` = p.`shop_id` AND largest.`product_id` = p.`product_id`
  )
  GROUP BY p.`shop_id`, p.`product_id`
);
