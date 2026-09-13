import { createHash, randomUUID } from "node:crypto";
import { openSync, writeFileSync, closeSync, existsSync, fsyncSync, renameSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { sql } from "drizzle-orm";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import type { Database } from "@/db/client";
import * as schema from "@/db/schema";
import journal from "../drizzle/meta/_journal.json";

export type SourceDatabaseManifest = {
  manifestVersion: 2;
  capturedAt: string;
  databaseName: string;
  databaseHostname: string;
  shopId?: string;
  migration: {
    id: number;
    hash: string;
    createdAt: number;
    repoTag: string;
  };
  counts: {
    users: number;
    authUsers: number;
    authAccounts: number;
    authSessions: number;
    auditEntries: number;
  };
  manifestSha256: string;
};

export function parseDatabaseUrlInfo(rawUrl: string): { databaseName: string; databaseHostname: string } {
  const trimmed = rawUrl.trim();
  if (trimmed.startsWith("file:")) {
    const filePath = trimmed.slice("file:".length);
    const parts = filePath.split(/[/\\]/);
    const filename = parts[parts.length - 1] || "local.db";
    return {
      databaseName: filename.replace(/\.db$/, ""),
      databaseHostname: "localhost",
    };
  }

  try {
    const parsed = new URL(trimmed);
    const hostname = parsed.hostname;
    const dbName = hostname.split(".")[0] || "database";
    return {
      databaseName: dbName,
      databaseHostname: hostname,
    };
  } catch {
    return {
      databaseName: "unknown",
      databaseHostname: "unknown",
    };
  }
}

export function calculateManifestSha256(manifestData: Omit<SourceDatabaseManifest, "manifestSha256">): string {
  const canonicalString = JSON.stringify({
    manifestVersion: manifestData.manifestVersion,
    capturedAt: manifestData.capturedAt,
    databaseName: manifestData.databaseName,
    databaseHostname: manifestData.databaseHostname,
    shopId: manifestData.shopId,
    migration: {
      id: manifestData.migration.id,
      hash: manifestData.migration.hash,
      createdAt: manifestData.migration.createdAt,
      repoTag: manifestData.migration.repoTag,
    },
    counts: {
      users: manifestData.counts.users,
      authUsers: manifestData.counts.authUsers,
      authAccounts: manifestData.counts.authAccounts,
      authSessions: manifestData.counts.authSessions,
      auditEntries: manifestData.counts.auditEntries,
    },
  });

  return createHash("sha256").update(canonicalString, "utf8").digest("hex");
}

type DatabaseExecutor = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

export async function captureSourceManifest(
  database: Database,
  options: {
    databaseUrl?: string;
    databaseName?: string;
    databaseHostname?: string;
    shopId?: string;
    capturedAt?: string;
  } = {}
): Promise<SourceDatabaseManifest> {
  const capturedAt = options.capturedAt ?? new Date().toISOString();
  const urlInfo = options.databaseUrl
    ? parseDatabaseUrlInfo(options.databaseUrl)
    : {
        databaseName: options.databaseName ?? "local",
        databaseHostname: options.databaseHostname ?? "localhost",
      };

  const dbName = options.databaseName ?? urlInfo.databaseName;
  const dbHostname = options.databaseHostname ?? urlInfo.databaseHostname;
  const shopId = options.shopId?.trim() || undefined;

  const executeCapture = async (tx: DatabaseExecutor): Promise<SourceDatabaseManifest> => {
    // 1. Migration Head (Fail-closed)
    let migrationRow: { id: number; hash: string; created_at: number } | undefined;
    try {
      const result = await (tx as Database).all(
        sql`SELECT id, hash, created_at FROM __drizzle_migrations ORDER BY created_at DESC, id DESC LIMIT 1`
      );
      if (result && result.length > 0) {
        migrationRow = {
          id: Number((result[0] as { id: number }).id),
          hash: String((result[0] as { hash: string }).hash),
          created_at: Number((result[0] as { created_at: number }).created_at),
        };
      }
    } catch (err: unknown) {
      throw new Error(
        `MANIFEST_CAPTURE_FAILED: Unable to query __drizzle_migrations table: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }

    if (!migrationRow || !migrationRow.hash || migrationRow.hash.trim().length === 0) {
      throw new Error(
        "MANIFEST_CAPTURE_FAILED: __drizzle_migrations is empty or missing valid migration hash. Refusing to generate incomplete manifest."
      );
    }

    const matchingJournalEntry = journal.entries.find((e) => e.when === migrationRow.created_at);
    if (!matchingJournalEntry) {
      throw new Error(
        `MANIFEST_CAPTURE_FAILED: Migration head ${migrationRow.id} (${migrationRow.created_at}) does not match the repository migration journal.`
      );
    }
    const migrationTag = matchingJournalEntry.tag;

    const migrationInfo = {
      // Turso/libSQL may return NULL for the legacy `id` column. The journal
      // index is the repository's stable migration identity in that case.
      id: matchingJournalEntry.idx,
      hash: migrationRow.hash,
      createdAt: migrationRow.created_at,
      repoTag: migrationTag,
    };

    // 2. Table Counts
    let usersCountResult;
    let authUsersCountResult;
    let authAccountsCountResult;
    let authSessionsCountResult;
    let auditEntriesCountResult;

    if (shopId) {
      usersCountResult = await (tx as Database).all(
        sql`SELECT count(*) as count FROM users WHERE shop_id = ${shopId}`
      );
      authUsersCountResult = await (tx as Database).all(
        sql`SELECT count(*) as count FROM auth_users WHERE id IN (SELECT id FROM users WHERE shop_id = ${shopId})`
      );
      authAccountsCountResult = await (tx as Database).all(
        sql`SELECT count(*) as count FROM auth_accounts WHERE user_id IN (SELECT id FROM users WHERE shop_id = ${shopId})`
      );
      authSessionsCountResult = await (tx as Database).all(
        sql`SELECT count(*) as count FROM auth_sessions WHERE user_id IN (SELECT id FROM users WHERE shop_id = ${shopId})`
      );
      auditEntriesCountResult = await (tx as Database).all(
        sql`SELECT count(*) as count FROM audit_entries WHERE shop_id = ${shopId}`
      );
    } else {
      usersCountResult = await (tx as Database).all(sql`SELECT count(*) as count FROM users`);
      authUsersCountResult = await (tx as Database).all(sql`SELECT count(*) as count FROM auth_users`);
      authAccountsCountResult = await (tx as Database).all(sql`SELECT count(*) as count FROM auth_accounts`);
      authSessionsCountResult = await (tx as Database).all(sql`SELECT count(*) as count FROM auth_sessions`);
      auditEntriesCountResult = await (tx as Database).all(sql`SELECT count(*) as count FROM audit_entries`);
    }

    const counts = {
      users: Number((usersCountResult[0] as { count: number })?.count ?? 0),
      authUsers: Number((authUsersCountResult[0] as { count: number })?.count ?? 0),
      authAccounts: Number((authAccountsCountResult[0] as { count: number })?.count ?? 0),
      authSessions: Number((authSessionsCountResult[0] as { count: number })?.count ?? 0),
      auditEntries: Number((auditEntriesCountResult[0] as { count: number })?.count ?? 0),
    };

    const manifestData = {
      manifestVersion: 2 as const,
      capturedAt,
      databaseName: dbName,
      databaseHostname: dbHostname,
      shopId,
      migration: migrationInfo,
      counts,
    };

    const manifestSha256 = calculateManifestSha256(manifestData);

    return {
      ...manifestData,
      manifestSha256,
    };
  };

  // Manifest capture is strictly read-only. Turso read-only tokens reject
  // Drizzle's default transaction because it opens a write-capable session.
  // Keep the individual reads on the read-only connection instead of
  // accidentally requiring write permission for evidence capture.
  return await executeCapture(database);
}

export function writeManifestSafely(
  filePath: string,
  manifest: SourceDatabaseManifest,
  options?: { allowOverwrite?: boolean }
): void {
  const resolved = resolve(filePath);
  if (existsSync(resolved) && !options?.allowOverwrite) {
    throw new Error(
      `MANIFEST_WRITE_FAILED: Manifest file already exists at '${resolved}'. Overwriting audit artifacts is prohibited.`
    );
  }

  const content = JSON.stringify(manifest, null, 2) + "\n";
  const tempPath = `${resolved}.tmp.${randomUUID()}`;
  const fd = openSync(tempPath, "wx", 0o600);
  try {
    writeFileSync(fd, content, { encoding: "utf8" });
    fsyncSync(fd);
  } catch (err) {
    try {
      unlinkSync(tempPath);
    } catch {
      // ignore temp cleanup error
    }
    throw err;
  } finally {
    closeSync(fd);
  }

  renameSync(tempPath, resolved);
}

async function main() {
  const args = process.argv.slice(2);
  let outputFile: string | undefined;
  let shopId: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--output" && i + 1 < args.length) {
      outputFile = args[++i];
    } else if (arg.startsWith("--output=")) {
      outputFile = arg.slice("--output=".length);
    } else if (arg === "--shop-id" && i + 1 < args.length) {
      shopId = args[++i];
    } else if (arg.startsWith("--shop-id=")) {
      shopId = arg.slice("--shop-id=".length);
    }
  }

  const databaseUrl = process.env.TURSO_DATABASE_URL || "file:local.db";
  const authToken = process.env.TURSO_AUTH_TOKEN;

  const client = createClient({
    url: databaseUrl,
    authToken,
  });

  try {
    const database = drizzle(client, { schema });
    const manifest = await captureSourceManifest(database, { databaseUrl, shopId });

    if (outputFile) {
      writeManifestSafely(outputFile, manifest);
      console.log(`Source manifest written to ${outputFile} (SHA-256: ${manifest.manifestSha256})`);
    } else {
      console.log(JSON.stringify(manifest, null, 2));
    }
    process.exitCode = 0;
  } catch (error) {
    console.error("Failed to capture source database manifest:", error);
    process.exitCode = 1;
  } finally {
    client.close();
  }
}

if (process.argv[1]?.endsWith("capture-source-manifest.ts") || process.argv[1]?.endsWith("capture-source-manifest.js")) {
  main();
}
