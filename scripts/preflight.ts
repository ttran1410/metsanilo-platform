import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sql } from "drizzle-orm";
import * as schema from "../src/db/schema";
import { validateRuntimeEnvironment } from "../src/lib/env";
import { assertNoOrphanedForcedChangeUsers } from "../src/lib/auth-integration";

const result = validateRuntimeEnvironment({ production: process.env.NODE_ENV === "production" || process.env.RELEASE_PREFLIGHT === "true" });
if (!result.ok) {
  console.error("Environment preflight failed:");
  for (const error of result.errors) console.error(`- ${error}`);
  process.exit(1);
}

const shopId = result.config.SHOP_ID || "shop-main";
const client = createClient({
  url: result.config.TURSO_DATABASE_URL,
  authToken: result.config.TURSO_AUTH_TOKEN,
});

try {
  const database = drizzle(client, { schema });
  const failures: string[] = [];
  try {
    await assertNoOrphanedForcedChangeUsers(database, shopId);
  } catch (error) {
    failures.push(`Credential invariant failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  const duplicates = await database.all(sql`
    SELECT shop_id, product_id, business_date, COUNT(*) AS row_count
    FROM availability
    WHERE shop_id = ${shopId} AND season_id IS NULL
    GROUP BY shop_id, product_id, business_date
    HAVING COUNT(*) > 1
  `);
  if (duplicates.length > 0) {
    const details = duplicates.map((row) => {
      const item = row as { shop_id: string; product_id: string; business_date: string; row_count: number };
      return `${item.shop_id}/${item.product_id}/${item.business_date} (${item.row_count} rows)`;
    });
    failures.push(
      `Legacy availability duplicates must be resolved before migration 0044 (${details.join(", ")}). ` +
      "Review each key; do not auto-merge capacity.",
    );
  }
  if (failures.length > 0) {
    throw new Error(failures.join("\n"));
  }
} catch (error) {
  console.error(`Preflight failed for shop ${shopId}:`, error);
  client.close();
  process.exit(1);
} finally {
  client.close();
}

console.log(`Environment and credential preflight passed for ${result.config.TURSO_DATABASE_URL.startsWith("file:") ? "local" : "remote"} database (shop: ${shopId}).`);
