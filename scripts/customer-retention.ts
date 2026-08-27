import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { findRetentionEligibleCustomers } from "../src/domain/customers";
import * as schema from "../src/db/schema";
import { validateRuntimeEnvironment } from "../src/lib/env";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const apply = args.has("--apply");
const limitArg = process.argv.find((value) => value.startsWith("--batch-limit="));
const batchLimit = Math.max(1, Number(limitArg?.split("=")[1] ?? 100));
if (!dryRun && !apply) throw new Error("Choose exactly one mode: --dry-run or --apply");
if (dryRun && apply) throw new Error("Choose only one mode: --dry-run or --apply");

const preflight = validateRuntimeEnvironment({ production: process.env.NODE_ENV === "production" });
if (!preflight.ok) throw new Error(`Environment preflight failed: ${preflight.errors.join("; ")}`);
const client = createClient({ url: preflight.config.TURSO_DATABASE_URL, authToken: preflight.config.TURSO_AUTH_TOKEN });
const database = drizzle(client, { schema });
try {
  const eligible = (await findRetentionEligibleCustomers(database)).slice(0, batchLimit);
  console.log(JSON.stringify({ mode: dryRun ? "dry-run" : "apply", batchLimit, eligibleCount: eligible.length, eligible }, null, 2));
  if (apply && eligible.length > 0) {
    throw new Error("Apply mode is intentionally gated until retention hold and anonymization batch transaction are enabled.");
  }
} finally {
  client.close();
}
