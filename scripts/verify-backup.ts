import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import type { Database } from "@/db/client";
import * as schema from "@/db/schema";
import {
  type SourceDatabaseManifest,
  calculateManifestSha256,
  captureSourceManifest,
  parseDatabaseUrlInfo,
} from "./capture-source-manifest";

export type BackupVerificationOptions = {
  expectedBackupName?: string;
  expectedGroup?: string;
  actualBackupGroup?: string;
  productionHostname?: string;
  backupDatabaseUrl?: string;
};

export type BackupVerificationResult = {
  ok: boolean;
  errors: string[];
  backupManifest: SourceDatabaseManifest;
  sourceManifest: SourceDatabaseManifest;
};

export function maskDatabaseUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    parsed.password = "***";
    parsed.username = parsed.username ? "***" : "";
    return parsed.toString();
  } catch {
    return rawUrl.startsWith("file:") ? rawUrl : "masked-database-url";
  }
}

export function validateBackupManifestIntegrity(manifest: SourceDatabaseManifest): void {
  if (manifest.manifestVersion !== 2) {
    throw new Error(`LEGACY_MANIFEST_VERSION_UNSUPPORTED: ${manifest.manifestVersion}`);
  }
  const expectedHash = calculateManifestSha256(manifest);
  if (expectedHash !== manifest.manifestSha256) {
    throw new Error(
      `Manifest checksum verification failed: expected ${manifest.manifestSha256}, calculated ${expectedHash}`
    );
  }
}

export async function verifyBackupDatabase(
  backupDatabase: Database,
  sourceManifest: SourceDatabaseManifest,
  options: BackupVerificationOptions = {}
): Promise<BackupVerificationResult> {
  const errors: string[] = [];

  // 1. Verify Source Manifest integrity
  validateBackupManifestIntegrity(sourceManifest);

  // 2. Anti-production check
  if (options.productionHostname && options.backupDatabaseUrl) {
    const backupInfo = parseDatabaseUrlInfo(options.backupDatabaseUrl);
    const prodHost = options.productionHostname.trim().toLowerCase();
    const backupHost = backupInfo.databaseHostname.trim().toLowerCase();

    if (prodHost !== "" && prodHost !== "localhost" && backupHost === prodHost) {
      throw new Error(
        `ANTI_PRODUCTION_GUARD_TRIGGERED: Backup database URL (${maskDatabaseUrl(
          options.backupDatabaseUrl
        )}) points to production hostname '${prodHost}'.`
      );
    }
  }

  // 3. Capture backup database manifest
  const backupManifest = await captureSourceManifest(backupDatabase, {
    databaseUrl: options.backupDatabaseUrl,
    shopId: sourceManifest.shopId,
  });

  // 4. Verify Expected Metadata (Backup name and group)
  if (options.expectedBackupName && options.expectedBackupName.trim().length > 0) {
    if (backupManifest.databaseName.toLowerCase() !== options.expectedBackupName.trim().toLowerCase()) {
      errors.push(
        `Backup database name mismatch: expected '${options.expectedBackupName}', got '${backupManifest.databaseName}'`
      );
    }
  }
  if (options.expectedGroup && options.expectedGroup.trim().length > 0) {
    if (!options.actualBackupGroup) {
      throw new Error("BACKUP_METADATA_UNAVAILABLE: Cannot verify expected backup group without provider metadata.");
    }
    if (options.actualBackupGroup.trim().toLowerCase() !== options.expectedGroup.trim().toLowerCase()) {
      errors.push(`Backup group mismatch: expected '${options.expectedGroup}', got '${options.actualBackupGroup}'`);
    }
  }

  // 5. Verify Migration Head
  if (backupManifest.migration.id !== sourceManifest.migration.id) {
    errors.push(
      `Migration ID mismatch: backup has ${backupManifest.migration.id}, source has ${sourceManifest.migration.id}`
    );
  }
  if (backupManifest.migration.hash !== sourceManifest.migration.hash) {
    errors.push(
      `Migration hash mismatch: backup has '${backupManifest.migration.hash}', source has '${sourceManifest.migration.hash}'`
    );
  }
  if (backupManifest.migration.createdAt !== sourceManifest.migration.createdAt) {
    errors.push(
      `Migration createdAt mismatch: backup has ${backupManifest.migration.createdAt}, source has ${sourceManifest.migration.createdAt}`
    );
  }

  // 6. Verify Table Counts
  if (backupManifest.counts.users !== sourceManifest.counts.users) {
    errors.push(`Table users count mismatch: backup ${backupManifest.counts.users} != source ${sourceManifest.counts.users}`);
  }
  if (backupManifest.counts.authUsers !== sourceManifest.counts.authUsers) {
    errors.push(`Table auth_users count mismatch: backup ${backupManifest.counts.authUsers} != source ${sourceManifest.counts.authUsers}`);
  }
  if (backupManifest.counts.authAccounts !== sourceManifest.counts.authAccounts) {
    errors.push(`Table auth_accounts count mismatch: backup ${backupManifest.counts.authAccounts} != source ${sourceManifest.counts.authAccounts}`);
  }
  if (backupManifest.counts.authSessions !== sourceManifest.counts.authSessions) {
    errors.push(`Table auth_sessions count mismatch: backup ${backupManifest.counts.authSessions} != source ${sourceManifest.counts.authSessions}`);
  }
  if (backupManifest.counts.auditEntries !== sourceManifest.counts.auditEntries) {
    errors.push(`Table audit_entries count mismatch: backup ${backupManifest.counts.auditEntries} != source ${sourceManifest.counts.auditEntries}`);
  }

  return {
    ok: errors.length === 0,
    errors,
    backupManifest,
    sourceManifest,
  };
}

async function main() {
  const args = process.argv.slice(2);
  let manifestFile: string | undefined;
  let backupUrl: string | undefined;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  let productionHostname: string | undefined;
  let expectedBackupName: string | undefined;
  let expectedGroup: string | undefined;
  const actualBackupGroup = process.env.TURSO_BACKUP_GROUP;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--manifest-file" && i + 1 < args.length) {
      manifestFile = args[++i];
    } else if (arg.startsWith("--manifest-file=")) {
      manifestFile = arg.slice("--manifest-file=".length);
    } else if (arg === "--backup-url" && i + 1 < args.length) {
      backupUrl = args[++i];
    } else if (arg.startsWith("--backup-url=")) {
      backupUrl = arg.slice("--backup-url=".length);
    } else if (arg === "--production-hostname" && i + 1 < args.length) {
      productionHostname = args[++i];
    } else if (arg.startsWith("--production-hostname=")) {
      productionHostname = arg.slice("--production-hostname=".length);
    } else if (arg === "--expected-backup-name" && i + 1 < args.length) {
      expectedBackupName = args[++i];
    } else if (arg.startsWith("--expected-backup-name=")) {
      expectedBackupName = arg.slice("--expected-backup-name=".length);
    } else if (arg === "--expected-group" && i + 1 < args.length) {
      expectedGroup = args[++i];
    } else if (arg.startsWith("--expected-group=")) {
      expectedGroup = arg.slice("--expected-group=".length);
    }
  }

  if (!manifestFile) {
    console.error("Error: --manifest-file <path> is required.");
    process.exitCode = 2;
    return;
  }

  const url = backupUrl || process.env.TURSO_DATABASE_URL;
  if (!url) {
    console.error("Error: --backup-url or TURSO_DATABASE_URL is required.");
    process.exitCode = 2;
    return;
  }

  let sourceManifest: SourceDatabaseManifest;
  try {
    const rawContent = readFileSync(resolve(manifestFile), "utf8");
    sourceManifest = JSON.parse(rawContent);
    validateBackupManifestIntegrity(sourceManifest);
  } catch (error) {
    console.error("Failed to read or validate source manifest file:", error);
    process.exitCode = 2;
    return;
  }

  const client = createClient({
    url,
    authToken,
  });

  try {
    const database = drizzle(client, { schema });
    const result = await verifyBackupDatabase(database, sourceManifest, {
      backupDatabaseUrl: url,
      productionHostname,
      expectedBackupName,
      expectedGroup,
      actualBackupGroup,
    });

    if (result.ok) {
      console.log(`Backup verification PASSED against source manifest (Captured at: ${sourceManifest.capturedAt}).`);
      console.log(`Migration Head: ${result.backupManifest.migration.repoTag} (${result.backupManifest.migration.createdAt})`);
      console.log(`Verified Users: ${result.backupManifest.counts.users}, AuthUsers: ${result.backupManifest.counts.authUsers}, Sessions: ${result.backupManifest.counts.authSessions}`);
      process.exitCode = 0;
    } else {
      console.error(`Backup verification FAILED with ${result.errors.length} mismatch(es):`);
      for (const err of result.errors) {
        console.error(`  - ${err}`);
      }
      process.exitCode = 1;
    }
  } catch (error) {
    console.error("Backup verification runtime error:", error);
    process.exitCode = 2;
  } finally {
    client.close();
  }
}

if (process.argv[1]?.endsWith("verify-backup.ts") || process.argv[1]?.endsWith("verify-backup.js")) {
  main();
}
