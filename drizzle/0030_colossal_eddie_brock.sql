ALTER TABLE `shop_payment_methods` ADD `instructions_fi` text;--> statement-breakpoint
ALTER TABLE `shop_payment_methods` ADD `instructions_en` text;--> statement-breakpoint
ALTER TABLE `shop_payment_methods` ADD `merchant_details_json` text;--> statement-breakpoint
ALTER TABLE `shops` ADD `business_name` text;--> statement-breakpoint
ALTER TABLE `shops` ADD `business_id` text;--> statement-breakpoint
ALTER TABLE `shops` ADD `logo_url` text;--> statement-breakpoint
ALTER TABLE `shops` ADD `favicon_url` text;--> statement-breakpoint
ALTER TABLE `shops` ADD `how_it_works_visible` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `shops` ADD `about_us_visible` integer DEFAULT true NOT NULL;