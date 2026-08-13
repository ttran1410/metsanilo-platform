import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { validateRuntimeEnvironment } from "../src/lib/env";

const preflight = validateRuntimeEnvironment({ production: process.env.NODE_ENV === "production" || process.env.RELEASE_PREFLIGHT === "true" });
if (!preflight.ok) {
  throw new Error(`Environment preflight failed: ${preflight.errors.join("; ")}`);
}

const url = preflight.config.TURSO_DATABASE_URL;
const client = createClient({ url, authToken: preflight.config.TURSO_AUTH_TOKEN });
try {
  await migrate(drizzle(client), { migrationsFolder: "drizzle" });
  console.log(`Migrations applied to ${url.startsWith("file:") ? url : "configured Turso database"}.`);
} finally {
  client.close();
}
