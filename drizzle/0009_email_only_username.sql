PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__new_users` (
  `id` text PRIMARY KEY NOT NULL,
  `shop_id` text NOT NULL REFERENCES `shops`(`id`),
  `username` text,
  `email` text,
  `password_hash` text NOT NULL,
  `must_change_password` integer DEFAULT false NOT NULL,
  `session_version` integer DEFAULT 1 NOT NULL,
  `display_name` text NOT NULL,
  `role` text NOT NULL,
  `active` integer DEFAULT true NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_users` (`id`, `shop_id`, `username`, `email`, `password_hash`, `must_change_password`, `session_version`, `display_name`, `role`, `active`, `created_at`)
SELECT `id`, `shop_id`, `username`, `email`, `password_hash`, `must_change_password`, `session_version`, `display_name`, `role`, `active`, `created_at` FROM `users`;
--> statement-breakpoint
DROP TABLE `users`;
--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;
--> statement-breakpoint
CREATE UNIQUE INDEX `users_shop_username_unique` ON `users` (`shop_id`, `username`);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
--> statement-breakpoint
PRAGMA foreign_keys=ON;
