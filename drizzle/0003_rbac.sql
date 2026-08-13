CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`shop_id` text NOT NULL REFERENCES `shops`(`id`),
	`username` text NOT NULL,
	`display_name` text NOT NULL,
	`role` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_shop_username_unique` ON `users` (`shop_id`,`username`);
--> statement-breakpoint
CREATE TABLE `user_permissions` (
	`id` text PRIMARY KEY NOT NULL,
	`shop_id` text NOT NULL REFERENCES `shops`(`id`),
	`user_id` text NOT NULL REFERENCES `users`(`id`),
	`permission` text NOT NULL,
	`granted` integer DEFAULT true NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_permissions_user_code_unique` ON `user_permissions` (`user_id`,`permission`);
