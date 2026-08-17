PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `customers_rg_temp` (
	`id` text PRIMARY KEY NOT NULL,
	`shop_id` text NOT NULL REFERENCES `shops`(`id`),
	`name` text NOT NULL,
	`mobile` text,
	`email` text,
	`match_status` text DEFAULT 'ACTIVE' NOT NULL,
	`marketing_consent` integer DEFAULT false NOT NULL,
	`marketing_consent_status` text DEFAULT 'NOT_CONSENTED' NOT NULL,
	`marketing_consent_at` text,
	`marketing_consent_source` text,
	`marketing_consent_updated_by` text,
	`notes` text,
	`facebook_profile` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `customers_rg_temp` SELECT `id`, `shop_id`, `name`, `mobile`, `email`, `match_status`, `marketing_consent`, `marketing_consent_status`, `marketing_consent_at`, `marketing_consent_source`, `marketing_consent_updated_by`, `notes`, `facebook_profile`, `created_at`, `updated_at` FROM `customers`;
--> statement-breakpoint
DROP TABLE `customers`;
--> statement-breakpoint
ALTER TABLE `customers_rg_temp` RENAME TO `customers`;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `customers_shop_mobile_idx` ON `customers` (`shop_id`,`mobile`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `customers_shop_email_idx` ON `customers` (`shop_id`,`email`);
--> statement-breakpoint
PRAGMA foreign_keys=ON;
