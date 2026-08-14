CREATE TABLE `media_assets` (
  `id` text PRIMARY KEY NOT NULL,
  `shop_id` text NOT NULL REFERENCES `shops`(`id`),
  `url` text NOT NULL,
  `pathname` text NOT NULL,
  `mime_type` text NOT NULL,
  `size_bytes` integer NOT NULL,
  `alt_fi` text NOT NULL,
  `alt_en` text NOT NULL,
  `caption_fi` text DEFAULT '' NOT NULL,
  `caption_en` text DEFAULT '' NOT NULL,
  `active` integer DEFAULT true NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `media_assets_shop_idx` ON `media_assets` (`shop_id`);
--> statement-breakpoint
CREATE TABLE `media_attachments` (
  `id` text PRIMARY KEY NOT NULL,
  `shop_id` text NOT NULL REFERENCES `shops`(`id`),
  `asset_id` text NOT NULL REFERENCES `media_assets`(`id`),
  `product_id` text REFERENCES `products`(`id`),
  `page_key` text,
  `sort_order` integer DEFAULT 0 NOT NULL,
  `is_primary` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX `media_attachments_product_idx` ON `media_attachments` (`shop_id`,`product_id`,`sort_order`);
--> statement-breakpoint
WITH default_permissions(permission) AS (VALUES ('cms.edit'), ('media.write'))
INSERT OR IGNORE INTO user_permissions (id, shop_id, user_id, permission, granted, updated_at)
SELECT lower(hex(randomblob(16))), u.shop_id, u.id, p.permission, 1, datetime('now')
FROM users u CROSS JOIN default_permissions p
WHERE u.role IN ('STAFF', 'CONTENT_CREATOR');
