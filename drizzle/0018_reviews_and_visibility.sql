CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`shop_id` text NOT NULL,
	`customer_id` text,
	`order_id` text,
	`product_id` text,
	`display_name` text NOT NULL,
	`contact` text,
	`rating` integer NOT NULL,
	`original_text` text NOT NULL,
	`display_text` text,
	`source` text DEFAULT 'PUBLIC_FORM' NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`publication_acknowledgement` integer DEFAULT false NOT NULL,
	`acknowledgement_source` text,
	`acknowledged_at` text,
	`featured` integer DEFAULT false NOT NULL,
	`featured_until` text,
	`moderation_reason` text,
	`moderated_by` text,
	`moderated_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `reviews_shop_status_idx` ON `reviews` (`shop_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `reviews_shop_featured_idx` ON `reviews` (`shop_id`,`featured`,`featured_until`);--> statement-breakpoint
ALTER TABLE `shops` ADD `reviews_visible` integer DEFAULT true NOT NULL;