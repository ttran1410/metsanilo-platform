import { spawnSync } from "node:child_process";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import { users } from "../src/db/schema";
import { validateRuntimeEnvironment } from "../src/lib/env";

// Operator-only release gate: migrate, seed, then verify the active Admin.
const preflight = validateRuntimeEnvironment({ production: true });
if (!preflight.ok) throw new Error(`Environment preflight failed: ${preflight.errors.join("; ")}`);

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, { stdio: "inherit", env: process.env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("npm", ["run", "db:migrate"]);
run("npm", ["run", "db:seed"]);

const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
if (!email) throw new Error("BOOTSTRAP_ADMIN_EMAIL is required to verify the bootstrap Admin.");
const client = createClient({ url: preflight.config.TURSO_DATABASE_URL, authToken: preflight.config.TURSO_AUTH_TOKEN });
try {
  const database = drizzle(client);
  const [admin] = await database.select({ email: users.email, role: users.role, active: users.active }).from(users).where(eq(users.email, email)).limit(1);
  if (!admin || admin.role !== "ADMIN" || !admin.active) throw new Error(`Bootstrap Admin verification failed for ${email}.`);
  console.log(`Release gate passed: migrations applied, seed completed, and active Admin verified for ${email}.`);
} finally {
  client.close();
}
