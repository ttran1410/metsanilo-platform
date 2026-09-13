import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sql } from "drizzle-orm";
import * as schema from "../src/db/schema";
import { env, validateRuntimeEnvironment } from "../src/lib/env";
import journal from "../drizzle/meta/_journal.json";

const REQUIRED_USER_COLUMNS = [
  "id", "shop_id", "username", "email", "must_change_password",
  "temporary_password_issued_at", "temporary_password_expires_at",
  "display_name", "role", "active", "created_at",
] as const;

function fail(message: string, code = 1): never {
  console.error(message);
  process.exit(code);
}

const preflight = validateRuntimeEnvironment({ production: process.env.RELEASE_PREFLIGHT === "true" });
if (!preflight.ok) fail(`Environment validation failed: ${preflight.errors.join("; ")}`, 2);

const config = env();
const client = createClient({ url: config.TURSO_DATABASE_URL, authToken: config.TURSO_AUTH_TOKEN });
const database = drizzle(client, { schema });

try {
  const migrations = await database.all(sql`SELECT id, hash, created_at FROM __drizzle_migrations ORDER BY created_at DESC, id DESC LIMIT 1`);
  const head = migrations[0] as { id?: number; hash?: string; created_at?: number } | undefined;
  const journalEntry = journal.entries.find((entry) => entry.idx === 42);
  const migrationSqlPath = journalEntry ? `drizzle/${journalEntry.tag}.sql` : "";
  const expectedHash = migrationSqlPath ? createHash("sha256").update(readFileSync(migrationSqlPath)).digest("hex") : "";
  if (!head || !journalEntry || Number(head.created_at) !== journalEntry.when || String(head.hash) !== expectedHash) {
    fail(`Schema contract migration head mismatch: expected 0042 (${journalEntry?.tag ?? "missing journal entry"}).`, 1);
  }

  const columns = await database.all(sql`PRAGMA table_info(users)`);
  const columnNames = new Set(columns.map((column) => String((column as { name: string }).name)));
  for (const required of REQUIRED_USER_COLUMNS) {
    if (!columnNames.has(required)) fail(`Schema contract invariant failed: users.${required} is missing.`);
  }
  for (const retired of ["password_hash", "session_version"]) {
    if (columnNames.has(retired)) fail(`Schema contract invariant failed: users.${retired} still exists.`);
  }

  const indexes = await database.all(sql`PRAGMA index_list(users)`);
  if (!indexes.some((index) => String((index as { name: string }).name) === "users_email_unique")) {
    fail("Schema contract invariant failed: users_email_unique is missing.");
  }

  const foreignKeys = await database.all(sql`PRAGMA foreign_key_list(user_permissions)`);
  if (!foreignKeys.some((foreignKey) => String((foreignKey as { table: string }).table) === "users")) {
    fail("Schema contract invariant failed: user_permissions does not reference users.");
  }

  const foreignKeyErrors = await database.all(sql`PRAGMA foreign_key_check`);
  if (foreignKeyErrors.length > 0) fail(`Schema contract invariant failed: ${foreignKeyErrors.length} foreign-key violations found.`);

  const shopId = config.SHOP_ID;
  const invalidActiveUsers = await database.all(sql`
    SELECT u.id FROM users u
    LEFT JOIN auth_users au ON au.id = u.id
    LEFT JOIN auth_accounts aa ON aa.user_id = u.id AND aa.provider_id = 'credential'
    WHERE u.shop_id = ${shopId} AND u.active = 1
    GROUP BY u.id
    HAVING COUNT(DISTINCT au.id) != 1 OR COUNT(DISTINCT aa.id) != 1
  `);
  if (invalidActiveUsers.length > 0) fail(`Schema contract invariant failed: ${invalidActiveUsers.length} active users have invalid auth mapping.`);

  const orphanChecks = await Promise.all([
    database.all(sql`SELECT au.id FROM auth_users au LEFT JOIN users u ON u.id = au.id WHERE u.id IS NULL`),
    database.all(sql`SELECT aa.id FROM auth_accounts aa LEFT JOIN auth_users au ON au.id = aa.user_id WHERE au.id IS NULL`),
    database.all(sql`SELECT s.id FROM auth_sessions s LEFT JOIN auth_users au ON au.id = s.user_id WHERE au.id IS NULL`),
  ]);
  const orphanCount = orphanChecks.reduce((total, rows) => total + rows.length, 0);
  if (orphanCount > 0) fail(`Schema contract invariant failed: ${orphanCount} orphan authentication records found.`);

  console.log(`Schema contract verification passed for shop ${shopId}: migration head 0042, ${columns.length} users columns, no foreign-key or auth-graph violations.`);
} catch (error) {
  if (error instanceof Error && error.message.startsWith("Schema contract invariant failed:")) fail(error.message);
  fail(`Schema contract verification failed: ${error instanceof Error ? error.message : String(error)}`);
} finally {
  client.close();
}
