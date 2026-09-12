import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
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
  await assertNoOrphanedForcedChangeUsers(database, shopId);
} catch (error) {
  console.error(`Credential preflight failed for shop ${shopId}:`, error);
  client.close();
  process.exit(1);
} finally {
  client.close();
}

console.log(`Environment and credential preflight passed for ${result.config.TURSO_DATABASE_URL.startsWith("file:") ? "local" : "remote"} database (shop: ${shopId}).`);

