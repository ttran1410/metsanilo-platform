import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const mode = process.argv[2] ?? "quick";
const baseRef = process.argv[3] ?? "main";
const validModes = new Set(["quick", "full", "release"]);

if (!validModes.has(mode)) {
  console.error("Usage: node scripts/verify-local.mjs <quick|full|release> [base-ref]");
  process.exit(2);
}

function run(command, args, options = {}) {
  console.info(`\n> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: options.env ?? process.env,
    encoding: options.capture ? "utf8" : undefined,
    stdio: options.capture ? "pipe" : "inherit",
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (options.capture) {
      process.stderr.write(result.stderr ?? "");
      process.stderr.write(result.stdout ?? "");
    }
    process.exit(result.status ?? 1);
  }

  return options.capture ? (result.stdout ?? "").trim() : "";
}

function npm(script, options) {
  run("npm", ["run", script], options);
}

function git(args) {
  return run("git", args, { capture: true });
}

function changedEntries(mergeBase) {
  const tracked = git(["diff", "--name-status", mergeBase]).split("\n").filter(Boolean);
  const untracked = git(["ls-files", "--others", "--exclude-standard", "--", "src/db/schema.ts", "drizzle", "scripts/migrate.ts", "scripts/seed.ts", "scripts/release.ts"])
    .split("\n")
    .filter(Boolean)
    .map((path) => `A\t${path}`);
  return [...new Set([...tracked, ...untracked])];
}

function validateDatabaseChangeSet(entries) {
  const relevant = entries.filter((entry) => /(?:^|\t)(?:src\/db\/schema\.ts|drizzle\/|scripts\/(?:migrate|seed|release)\.ts)/.test(entry));
  if (relevant.length === 0) {
    console.info("\nNo database-sensitive changes detected relative to the base ref.");
    return false;
  }

  console.info("\nDatabase-sensitive changes:");
  relevant.forEach((entry) => console.info(`  ${entry}`));

  const migrationEntries = relevant.filter((entry) => entry.split("\t").at(-1)?.startsWith("drizzle/"));
  const changedAppliedSql = migrationEntries.some((entry) => entry.endsWith(".sql") && !entry.startsWith("A\t"));
  const changedSnapshot = migrationEntries.some((entry) => /drizzle\/meta\/\d+_snapshot\.json$/.test(entry) && !entry.startsWith("A\t"));
  const changedAppliedMigration = changedAppliedSql || changedSnapshot;
  if (changedAppliedMigration) {
    console.error("\nExisting migration files were modified, deleted, or renamed. Add a new migration instead.");
    process.exit(1);
  }

  const schemaChanged = relevant.some((entry) => entry.endsWith("\tsrc/db/schema.ts"));
  const newMigration = migrationEntries.some((entry) => entry.startsWith("A\t") && entry.endsWith(".sql"));
  if (schemaChanged && !newMigration) {
    console.error("\nsrc/db/schema.ts changed without a new drizzle SQL migration.");
    process.exit(1);
  }

  const operatorScriptChanged = relevant.some((entry) => /scripts\/(?:seed|release)\.ts$/.test(entry));
  if (operatorScriptChanged) {
    console.info("\nOperator seed/release scripts changed: require explicit maintainer and security review.");
  }

  return schemaChanged || migrationEntries.length > 0 || relevant.some((entry) => entry.endsWith("scripts/migrate.ts"));
}

function validateMigrationChain() {
  const directory = mkdtempSync(join(tmpdir(), "metsanilo-migration-check-"));
  const databasePath = join(directory, "migration-test.db");
  const environment = {
    ...process.env,
    NODE_ENV: "test",
    TURSO_DATABASE_URL: `file:${databasePath}`,
  };
  delete environment.TURSO_AUTH_TOKEN;
  delete environment.RELEASE_PREFLIGHT;

  try {
    console.info(`\nApplying the full migration chain to disposable database: ${databasePath}`);
    run("npm", ["run", "db:migrate"], { env: environment });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function buildWithLocalEnvironment() {
  const directory = mkdtempSync(join(tmpdir(), "metsanilo-build-check-"));
  const environment = {
    ...process.env,
    TURSO_DATABASE_URL: `file:${join(directory, "build.db")}`,
    BETTER_AUTH_SECRET: "local-verification-better-auth-secret-0001",
    BETTER_AUTH_URL: "http://localhost:3000",
    MEDIA_STORAGE: "local",
    MEDIA_LOCAL_DIR: join(directory, "uploads"),
  };
  delete environment.TURSO_AUTH_TOKEN;
  delete environment.RELEASE_PREFLIGHT;

  try {
    npm("build", { env: environment });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

npm("typecheck");
npm("lint");
npm("test");

if (mode === "full" || mode === "release") {
  buildWithLocalEnvironment();
}

if (mode === "release") {
  const mergeBase = git(["merge-base", baseRef, "HEAD"]);
  const entries = changedEntries(mergeBase);
  if (validateDatabaseChangeSet(entries)) validateMigrationChain();
}

console.info(`\nLocal ${mode} verification passed.`);
