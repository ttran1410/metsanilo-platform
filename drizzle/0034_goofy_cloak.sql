ALTER TABLE `reviews` ADD `reviewer_name` text;--> statement-breakpoint
ALTER TABLE `reviews` ADD `is_anonymous` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `reviews` ADD `public_name_consent_at` text;--> statement-breakpoint
ALTER TABLE `reviews` ADD `public_name_consent_source` text;--> statement-breakpoint
ALTER TABLE `reviews` ADD `public_name_consent_note` text;--> statement-breakpoint
ALTER TABLE `reviews` ADD `public_name_consent_by` text;--> statement-breakpoint
UPDATE `reviews` SET `reviewer_name` = `display_name` WHERE `reviewer_name` IS NULL;
