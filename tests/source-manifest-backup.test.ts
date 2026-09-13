import { mkdtempSync, rmSync, statSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createDatabaseConnection, type Database } from "@/db/client";
import { authAccounts, authUsers, shops, users } from "@/db/schema";
import { hashPassword } from "@/domain/passwords";
import { resetEnvForTests } from "@/lib/env";
import {
  captureSourceManifest,
  writeManifestSafely,
  parseDatabaseUrlInfo,
} from "../scripts/capture-source-manifest";
import {
  verifyBackupDatabase,
  validateBackupManifestIntegrity,
} from "../scripts/verify-backup";

const directory = mkdtempSync(join(tmpdir(), "metsanilo-manifest-test-"));
let sourceDb: Database;
let closeSourceDb: () => void;
let backupDb: Database;
let closeBackupDb: () => void;
let sequence = 0;

beforeEach(async () => {
  sequence += 2;
  const sourceUrl = `file:${join(directory, `${sequence - 1}.db`)}`;
  const backupUrl = `file:${join(directory, `${sequence}.db`)}`;
  process.env.TURSO_DATABASE_URL = sourceUrl;
  process.env.SHOP_ID = "shop-main";
  resetEnvForTests();

  const sourceConn = createDatabaseConnection(sourceUrl);
  sourceDb = sourceConn.database;
  closeSourceDb = sourceConn.close;

  const backupConn = createDatabaseConnection(backupUrl);
  backupDb = backupConn.database;
  closeBackupDb = backupConn.close;

  await migrate(sourceDb, { migrationsFolder: join(process.cwd(), "drizzle") });
  await migrate(backupDb, { migrationsFolder: join(process.cwd(), "drizzle") });

  const shopData = {
    id: "shop-main",
    slug: "main",
    nameFi: "Main",
    nameEn: "Main",
    timezone: "Europe/Helsinki",
    active: true,
    pickupNameFi: "Pickup",
    pickupNameEn: "Pickup",
    pickupAddress: "Test",
    pickupInstructionsFi: "Test",
    pickupInstructionsEn: "Test",
    pickupTime: "20:00",
  };
  await sourceDb.insert(shops).values(shopData);
  await backupDb.insert(shops).values(shopData);
});

afterEach(() => {
  closeSourceDb();
  closeBackupDb();
});

afterAll(() => {
  rmSync(directory, { recursive: true, force: true });
});

async function seedUser(db: Database, id: string, email: string, sessionVersion = 1) {
  const hash = hashPassword("Password123!");
  const now = new Date();
  await db.insert(users).values({
    id,
    shopId: "shop-main",
    email,
    username: email,
    displayName: email,
    passwordHash: hash,
    role: "ADMIN",
    active: true,
    sessionVersion,
    mustChangePassword: false,
    createdAt: now.toISOString(),
  });
  await db.insert(authUsers).values({
    id,
    name: email,
    email,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(authAccounts).values({
    id: `cred-${id}`,
    accountId: id,
    providerId: "credential",
    userId: id,
    password: hash,
    createdAt: now,
    updatedAt: now,
  });
}

describe("Source Manifest & Backup Verification", () => {
  it("captures accurate manifest and writes safely with 0600 mode", async () => {
    await seedUser(sourceDb, "user-1", "u1@example.com", 1);
    await seedUser(sourceDb, "user-2", "u2@example.com", 3);

    const manifest = await captureSourceManifest(sourceDb, {
      databaseUrl: "file:local.db",
    });

    expect(manifest.manifestVersion).toBe(1);
    expect(manifest.counts.users).toBe(2);
    expect(manifest.counts.authUsers).toBe(2);
    expect(manifest.counts.authAccounts).toBe(2);
    expect(manifest.sessionVersion.userCount).toBe(2);
    expect(manifest.sessionVersion.min).toBe(1);
    expect(manifest.sessionVersion.max).toBe(3);
    expect(manifest.sessionVersion.sum).toBe(4);
    expect(manifest.migration.repoTag).toBe("0041_noisy_legion");
    expect(manifest.manifestSha256).toBeDefined();

    const filePath = join(directory, "manifest.json");
    writeManifestSafely(filePath, manifest);

    const stats = statSync(filePath);
    // mode 0600: file mode mask 0o777 on unix
    expect(stats.mode & 0o777).toBe(0o600);

    const parsed = JSON.parse(readFileSync(filePath, "utf8"));
    expect(() => validateBackupManifestIntegrity(parsed)).not.toThrow();
  });

  it("successfully verifies identical backup database against source manifest", async () => {
    await seedUser(sourceDb, "user-1", "u1@example.com", 1);
    await seedUser(backupDb, "user-1", "u1@example.com", 1);

    const manifest = await captureSourceManifest(sourceDb, {
      databaseUrl: "libsql://prod-source.turso.io",
    });

    const result = await verifyBackupDatabase(backupDb, manifest, {
      backupDatabaseUrl: "libsql://prod-backup.turso.io",
      productionHostname: "prod-source.turso.io",
    });

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("detects manifest checksum tampering", async () => {
    await seedUser(sourceDb, "user-1", "u1@example.com", 1);
    const manifest = await captureSourceManifest(sourceDb);
    manifest.manifestSha256 = "invalid-tampered-hash";

    await expect(verifyBackupDatabase(backupDb, manifest)).rejects.toThrow(
      /Manifest checksum verification failed/
    );
  });

  it("fails verification when backup table count or session version mismatches", async () => {
    await seedUser(sourceDb, "user-1", "u1@example.com", 1);
    await seedUser(sourceDb, "user-2", "u2@example.com", 2);

    // Backup only has 1 user
    await seedUser(backupDb, "user-1", "u1@example.com", 1);

    const manifest = await captureSourceManifest(sourceDb);
    const result = await verifyBackupDatabase(backupDb, manifest);

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("Table users count mismatch"))).toBe(true);
    expect(result.errors.some((e) => e.includes("Session version userCount mismatch"))).toBe(true);
  });

  it("triggers anti-production guard when backup url hostname equals production hostname", async () => {
    const manifest = await captureSourceManifest(sourceDb);

    await expect(
      verifyBackupDatabase(backupDb, manifest, {
        backupDatabaseUrl: "libsql://prod.turso.io",
        productionHostname: "prod.turso.io",
      })
    ).rejects.toThrow(/ANTI_PRODUCTION_GUARD_TRIGGERED/);
  });

  it("parseDatabaseUrlInfo handles local file URLs and remote Turso URLs", () => {
    expect(parseDatabaseUrlInfo("file:local.db")).toEqual({
      databaseName: "local",
      databaseHostname: "localhost",
    });
    expect(parseDatabaseUrlInfo("file:/var/data/custom.db")).toEqual({
      databaseName: "custom",
      databaseHostname: "localhost",
    });
    expect(parseDatabaseUrlInfo("libsql://metsanilo-prod-ttran.turso.io")).toEqual({
      databaseName: "metsanilo-prod-ttran",
      databaseHostname: "metsanilo-prod-ttran.turso.io",
    });
  });
});
