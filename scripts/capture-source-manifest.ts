import { createHash } from "node:crypto";
import { openSync, writeFileSync, closeSync } from "node:fs";
import { resolve } from "node:path";
import { sql } from "drizzle-orm";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import type { Database } from "@/db/client";
import * as schema from "@/db/schema";
import journal from "../drizzle/meta/_journal.json";

export type SourceDatabaseManifest = {
  manifestVersion: 1;
  capturedAt: string;
  databaseName: string;
  databaseHostname: string;
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
  sessionVersion: {
    userCount: number;
    min: number;
    max: number;
    sum: number;
    sha256: string;
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
    sessionVersion: {
      userCount: manifestData.sessionVersion.userCount,
      min: manifestData.sessionVersion.min,
      max: manifestData.sessionVersion.max,
      sum: manifestData.sessionVersion.sum,
      sha256: manifestData.sessionVersion.sha256,
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

  const executeCapture = async (tx: DatabaseExecutor): Promise<SourceDatabaseManifest> => {
    // 1. Migration Head
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
    } catch {
      // Table might not exist or empty
    }

    const latestJournalEntry = journal.entries[journal.entries.length - 1];
    const migrationTag =
      journal.entries.find((e) => e.when === migrationRow?.created_at)?.tag ??
      latestJournalEntry?.tag ??
      "0041_noisy_legion";

    const migrationInfo = migrationRow
      ? {
          id: migrationRow.id,
          hash: migrationRow.hash,
          createdAt: migrationRow.created_at,
          repoTag: migrationTag,
        }
      : {
          id: journal.entries.length - 1,
          hash: "",
          createdAt: latestJournalEntry ? latestJournalEntry.when : 0,
          repoTag: migrationTag,
        };

    // 2. Table Counts
    const usersCountResult = await (tx as Database).all(sql`SELECT count(*) as count FROM users`);
    const authUsersCountResult = await (tx as Database).all(sql`SELECT count(*) as count FROM auth_users`);
    const authAccountsCountResult = await (tx as Database).all(sql`SELECT count(*) as count FROM auth_accounts`);
    const authSessionsCountResult = await (tx as Database).all(sql`SELECT count(*) as count FROM auth_sessions`);
    const auditEntriesCountResult = await (tx as Database).all(sql`SELECT count(*) as count FROM audit_entries`);

    const counts = {
      users: Number((usersCountResult[0] as { count: number })?.count ?? 0),
      authUsers: Number((authUsersCountResult[0] as { count: number })?.count ?? 0),
      authAccounts: Number((authAccountsCountResult[0] as { count: number })?.count ?? 0),
      authSessions: Number((authSessionsCountResult[0] as { count: number })?.count ?? 0),
      auditEntries: Number((auditEntriesCountResult[0] as { count: number })?.count ?? 0),
    };

    // 3. Session Version Stats
    const userVersionRows = (await (tx as Database).all(
      sql`SELECT id, session_version as sessionVersion FROM users ORDER BY id ASC`
    )) as Array<{ id: string; sessionVersion: number | null }>;

    let minVersion = 0;
    let maxVersion = 0;
    let sumVersion = 0;
    let versionSha256 = "";

    if (userVersionRows.length === 0) {
      versionSha256 = createHash("sha256").update("", "utf8").digest("hex");
    } else {
      const versions = userVersionRows.map((r) => Number(r.sessionVersion ?? 0));
      minVersion = Math.min(...versions);
      maxVersion = Math.max(...versions);
      sumVersion = versions.reduce((acc, v) => acc + v, 0);

      const hashPayload = userVersionRows
        .map((r) => `${r.id}:${r.sessionVersion ?? 0}`)
        .join("\n");
      versionSha256 = createHash("sha256").update(hashPayload, "utf8").digest("hex");
    }

    const sessionVersion = {
      userCount: userVersionRows.length,
      min: minVersion,
      max: maxVersion,
      sum: sumVersion,
      sha256: versionSha256,
    };

    const manifestData = {
      manifestVersion: 1 as const,
      capturedAt,
      databaseName: dbName,
      databaseHostname: dbHostname,
      migration: migrationInfo,
      counts,
      sessionVersion,
    };

    const manifestSha256 = calculateManifestSha256(manifestData);

    return {
      ...manifestData,
      manifestSha256,
    };
  };

  if (typeof database.transaction === "function") {
    return await database.transaction(async (tx) => executeCapture(tx));
  }
  return await executeCapture(database);
}

export function writeManifestSafely(filePath: string, manifest: SourceDatabaseManifest): void {
  const resolved = resolve(filePath);
  const content = JSON.stringify(manifest, null, 2) + "\n";
  const fd = openSync(resolved, "w", 0o600);
  try {
    writeFileSync(fd, content, { encoding: "utf8" });
  } finally {
    closeSync(fd);
  }
}

async function main() {
  const args = process.argv.slice(2);
  let outputFile: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--output" && i + 1 < args.length) {
      outputFile = args[++i];
    } else if (arg.startsWith("--output=")) {
      outputFile = arg.slice("--output=".length);
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
    const manifest = await captureSourceManifest(database, { databaseUrl });

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
