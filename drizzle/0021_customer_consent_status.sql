ALTER TABLE `customers` ADD `marketing_consent_status` text DEFAULT 'NOT_CONSENTED' NOT NULL;
--> statement-breakpoint
UPDATE `customers` SET `marketing_consent_status` = CASE WHEN `marketing_consent` = 1 THEN 'CONSENTED' ELSE 'NOT_CONSENTED' END;
