ALTER TABLE `customers` ADD `marketing_consent` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `customers` ADD `marketing_consent_at` text;--> statement-breakpoint
ALTER TABLE `customers` ADD `marketing_consent_source` text;--> statement-breakpoint
ALTER TABLE `customers` ADD `marketing_consent_updated_by` text;
