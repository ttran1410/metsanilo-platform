ALTER TABLE `reviews` ADD `verified_buyer` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `reviews` ADD `verification_type` text DEFAULT 'UNVERIFIED' NOT NULL;--> statement-breakpoint
ALTER TABLE `reviews` ADD `rejection_reason` text;--> statement-breakpoint
ALTER TABLE `reviews` ADD `seller_reply_text` text;--> statement-breakpoint
ALTER TABLE `reviews` ADD `seller_replied_at` text;--> statement-breakpoint
ALTER TABLE `reviews` ADD `seller_replied_by` text;--> statement-breakpoint
ALTER TABLE `shops` ADD `rating_avg` real DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE `shops` ADD `review_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `shops` ADD `star_distribution_json` text DEFAULT '{"5":0,"4":0,"3":0,"2":0,"1":0}' NOT NULL;