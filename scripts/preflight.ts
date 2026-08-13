import { validateRuntimeEnvironment } from "../src/lib/env";

const result = validateRuntimeEnvironment({ production: process.env.NODE_ENV === "production" || process.env.RELEASE_PREFLIGHT === "true" });
if (!result.ok) {
  console.error("Environment preflight failed:");
  for (const error of result.errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Environment preflight passed for ${result.config.TURSO_DATABASE_URL.startsWith("file:") ? "local" : "remote"} database.`);
