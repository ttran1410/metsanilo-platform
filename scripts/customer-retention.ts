import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { anonymizeCustomer, findRetentionEligibleCustomers } from "../src/domain/customers";
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
    const result = await database.transaction(async (tx) => {
      // Re-check inside the transaction so a concurrent order/hold/confirmation
      // cannot be anonymized based on the pre-transaction report.
      const current = await findRetentionEligibleCustomers(tx as never);
      const ids = new Set(eligible.map((item) => item.customerId));
      const toApply = current.filter((item) => ids.has(item.customerId)).slice(0, batchLimit);
      let anonymizedCount = 0;
      for (const item of toApply) {
        const outcome = await anonymizeCustomer(tx as never, item.customerId, "system:customer-retention");
        if (outcome.anonymized) anonymizedCount += 1;
      }
      return { recheckedCount: toApply.length, anonymizedCount };
    });
    console.log(JSON.stringify(result, null, 2));
  }
} finally {
  client.close();
}
