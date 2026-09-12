ALTER TABLE `auth_sessions` ADD `last_activity_at` integer;--> statement-breakpoint
CREATE INDEX `auth_sessions_user_id_idx` ON `auth_sessions` (`user_id`);