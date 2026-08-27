import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { auditEntries } from "../src/db/schema";
import { validateRuntimeEnvironment } from "../src/lib/env";

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const limitArg = process.argv.find((value) => value.startsWith("--batch-limit="));
const limit = Math.max(1, Number(limitArg?.split("=")[1] ?? 100));
const preflight = validateRuntimeEnvironment({ production: process.env.NODE_ENV === "production" });
if (!preflight.ok) throw new Error(`Environment preflight failed: ${preflight.errors.join("; ")}`);
const client = createClient({ url: preflight.config.TURSO_DATABASE_URL, authToken: preflight.config.TURSO_AUTH_TOKEN });
const database = drizzle(client);
try {
  const now = new Date();
  const expires = new Date(now);
  expires.setUTCFullYear(expires.getUTCFullYear() + 1);
  const rows = await database.all<{ id: string }>(sql`SELECT id FROM customers WHERE shop_id = ${preflight.config.SHOP_ID} AND contact_confirmed_at IS NULL LIMIT ${limit}`);
  if (!apply) {
    console.log(JSON.stringify({ mode: "dry-run", batchLimit: limit, eligibleCount: rows.length, expiresAt: expires.toISOString(), customerIds: rows.map((row) => row.id) }, null, 2));
  } else {
    for (const row of rows) {
      await database.run(sql`UPDATE customers SET contact_confirmed_at = ${now.toISOString()}, contact_confirmed_by = 'system:migration', contact_confirmation_channel = 'MIGRATION', contact_confirmation_note = 'Legacy customer migrated under transitional retention policy', contact_confirmation_expires_at = ${expires.toISOString()}, updated_at = ${now.toISOString()} WHERE id = ${row.id} AND shop_id = ${preflight.config.SHOP_ID} AND contact_confirmed_at IS NULL`);
      await database.insert(auditEntries).values({ id: randomUUID(), shopId: preflight.config.SHOP_ID, actor: "system:migration", action: "customer.contact_confirmation_migrated", entityType: "customer", entityId: row.id, detailsJson: JSON.stringify({ expiresAt: expires.toISOString() }), createdAt: now.toISOString() });
    }
    console.log(JSON.stringify({ mode: "apply", updatedCount: rows.length, expiresAt: expires.toISOString() }, null, 2));
  }
} finally { client.close(); }
