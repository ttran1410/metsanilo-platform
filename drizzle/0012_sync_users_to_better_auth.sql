-- Map the existing shop users into Better Auth using the same stable user id.
-- The legacy scrypt hash is intentionally retained; the Better Auth instance
-- uses the same password hash/verify functions during this migration.
INSERT OR IGNORE INTO auth_users (id, name, email, email_verified, image, created_at, updated_at)
SELECT id, display_name, lower(email), 1, NULL,
       CAST(strftime('%s', created_at) AS INTEGER) * 1000,
       CAST(strftime('%s', created_at) AS INTEGER) * 1000
FROM users
WHERE email IS NOT NULL;
--> statement-breakpoint

INSERT OR IGNORE INTO auth_accounts (id, account_id, provider_id, user_id, password, created_at, updated_at)
SELECT 'credential-' || id, id, 'credential', id, password_hash,
       CAST(strftime('%s', created_at) AS INTEGER) * 1000,
       CAST(strftime('%s', created_at) AS INTEGER) * 1000
FROM users
WHERE email IS NOT NULL;
