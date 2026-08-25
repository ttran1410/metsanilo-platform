ALTER TABLE `shops` ADD `same_day_cutoff_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `shops` ADD `same_day_cutoff_time` text DEFAULT '15:00' NOT NULL;