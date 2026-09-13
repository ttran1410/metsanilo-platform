import { mkdtempSync, rmSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createDatabaseConnection, type Database } from "@/db/client";
import { authAccounts, authUsers, shops } from "@/db/schema";
import { hashPassword } from "@/domain/passwords";
import { resetEnvForTests } from "@/lib/env";
import { auditAuthReadiness } from "../scripts/audit-auth-readiness";

type JournalEntry = {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
};

type Journal = {
  version: string;
  dialect: string;
  entries: JournalEntry[];
};

function readRepoJournal(): Journal {
  const journalPath = join(process.cwd(), "drizzle", "meta", "_journal.json");
  return JSON.parse(readFileSync(journalPath, "utf-8")) as Journal;
}

function createMigrationSubset(targetFolder: string, upToTag: string): void {
  const repoDrizzleDir = join(process.cwd(), "drizzle");
  const journal = readRepoJournal();
  const targetIdx = journal.entries.findIndex((e) => e.tag === upToTag);
  if (targetIdx === -1) {
    throw new Error(`Target migration tag ${upToTag} not found in journal`);
  }

  const subsetEntries = journal.entries.slice(0, targetIdx + 1);
  const metaDir = join(targetFolder, "meta");
  mkdirSync(metaDir, { recursive: true });

  const subsetJournal: Journal = {
    ...journal,
    entries: subsetEntries,
  };
  writeFileSync(join(metaDir, "_journal.json"), JSON.stringify(subsetJournal, null, 2), "utf-8");

  for (const entry of subsetEntries) {
    const sqlFile = `${entry.tag}.sql`;
    copyFileSync(join(repoDrizzleDir, sqlFile), join(targetFolder, sqlFile));
  }
}

describe("Dynamic Journal & Full Migration Chain", () => {
  let tempDir: string;
  let database: Database;
  let closeDatabase: () => void;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "metsanilo-dyn-journal-"));
    process.env.TURSO_DATABASE_URL = `file:${join(tempDir, "test.db")}`;
    process.env.SHOP_ID = "shop-main";
    resetEnvForTests();
    const conn = createDatabaseConnection(process.env.TURSO_DATABASE_URL);
    database = conn.database;
    closeDatabase = conn.close;
  });

  afterEach(() => {
    closeDatabase();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("validates journal integrity: contiguous indices, unique tags, non-empty SQL files, and no extraneous SQL files", () => {
    const journal = readRepoJournal();
    expect(journal.entries.length).toBeGreaterThanOrEqual(2);

    const drizzleDir = join(process.cwd(), "drizzle");
    const existingFiles = new Set(readdirSync(drizzleDir).filter((f) => f.endsWith(".sql")));

    const seenTags = new Set<string>();
    for (let i = 0; i < journal.entries.length; i++) {
      const entry = journal.entries[i];
      expect(entry.idx).toBe(i);
      expect(seenTags.has(entry.tag)).toBe(false);
      seenTags.add(entry.tag);

      const expectedSql = `${entry.tag}.sql`;
      expect(existingFiles.has(expectedSql)).toBe(true);

      const sqlContent = readFileSync(join(drizzleDir, expectedSql), "utf-8").trim();
      expect(sqlContent.length).toBeGreaterThan(0);
      existingFiles.delete(expectedSql);
    }

    // Assert no untracked/extraneous SQL files exist in drizzle/
    expect(Array.from(existingFiles)).toEqual([]);
  });

  it("applies migration chain from 0000 to current head idempotently and passes foreign_key_check", async () => {
    // First migration pass
    await migrate(database, { migrationsFolder: join(process.cwd(), "drizzle") });

    // Second migration pass (idempotency)
    await migrate(database, { migrationsFolder: join(process.cwd(), "drizzle") });

    // PRAGMA foreign_key_check
    const fkCheck = await database.all(sql`PRAGMA foreign_key_check`);
    expect(fkCheck).toEqual([]);

    // Check indexes exist
    const indexes = await database.all<{ name: string }>(
      sql`SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'auth_%'`
    );
    expect(indexes.some((idx) => idx.name === "auth_sessions_user_id_idx")).toBe(true);

    // Verify shops table is present and insertable
    await database.insert(shops).values({
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
    });

    const foundShop = await database.query.shops.findFirst({
      where: (s, { eq }) => eq(s.id, "shop-main"),
    });
    expect(foundShop).toBeDefined();
    expect(foundShop?.id).toBe("shop-main");
  });
});

describe("Pinned Historical Cutover Regression (0040_wide_anthem -> 0041_noisy_legion)", () => {
  let tempDir: string;
  let database: Database;
  let closeDatabase: () => void;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "metsanilo-pinned-cutover-"));
    process.env.TURSO_DATABASE_URL = `file:${join(tempDir, "test.db")}`;
    process.env.SHOP_ID = "shop-main";
    resetEnvForTests();
    const conn = createDatabaseConnection(process.env.TURSO_DATABASE_URL);
    database = conn.database;
    closeDatabase = conn.close;
  });

  afterEach(() => {
    closeDatabase();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("verifies 0041_noisy_legion adds nullable last_activity_at and preserves session tokens, users, and credentials across migration", async () => {
    const journal = readRepoJournal();
    const target0041 = journal.entries.find((e) => e.tag === "0041_noisy_legion");
    expect(target0041).toBeDefined();

    // 1. Create subset 0..0040
    const subset0040Dir = join(tempDir, "drizzle-0040");
    createMigrationSubset(subset0040Dir, "0040_wide_anthem");

    // 2. Migrate DB up to 0040
    await migrate(database, { migrationsFolder: subset0040Dir });

    // 3. Seed pre-cutover state (shop, users, auth_users, auth_accounts, auth_sessions)
    const now = new Date("2026-09-12T12:00:00.000Z");
    const expiresAt = new Date("2026-09-19T12:00:00.000Z");
    const adminHash = hashPassword("AdminPass123!");
    const managerHash = hashPassword("ManagerPass123!");

    await database.insert(shops).values({
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
    });

    await database.run(sql`INSERT INTO users (id, shop_id, username, email, password_hash, must_change_password, session_version, display_name, role, active, created_at) VALUES
      ('admin-cutover', 'shop-main', 'admin@example.test', 'admin@example.test', ${hashPassword("Password123!")}, 0, 1, 'Admin Cutover', 'ADMIN', 1, ${now.toISOString()}),
      ('manager-cutover', 'shop-main', 'manager@example.test', 'manager@example.test', ${hashPassword("Password123!")}, 0, 1, 'Manager Cutover', 'MANAGER', 1, ${now.toISOString()})`);

    await database.insert(authUsers).values([
      {
        id: "admin-cutover",
        name: "Admin Cutover",
        email: "admin@example.test",
        emailVerified: false,
        image: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "manager-cutover",
        name: "Manager Cutover",
        email: "manager@example.test",
        emailVerified: false,
        image: null,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    await database.insert(authAccounts).values([
      {
        id: "credential-admin-cutover",
        accountId: "admin-cutover",
        providerId: "credential",
        userId: "admin-cutover",
        password: adminHash,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "credential-manager-cutover",
        accountId: "manager-cutover",
        providerId: "credential",
        userId: "manager-cutover",
        password: managerHash,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    // Insert pre-0041 session using raw SQL (no last_activity_at column exists in schema at 0040)
    await database.run(
      sql`INSERT INTO auth_sessions (id, user_id, token, expires_at, ip_address, user_agent, created_at, updated_at) VALUES (${"session-pre-cutover"}, ${"admin-cutover"}, ${"secret-pre-cutover-token-xyz"}, ${expiresAt.getTime()}, ${"192.168.1.100"}, ${"Mozilla/5.0 Cutover Browser"}, ${now.getTime()}, ${now.getTime()})`
    );

    // Snapshot pre-migration counts
    const preUsersCount = (await database.all<{ count: number }>(sql`SELECT count(*) as count FROM users`))[0].count;
    const preSessionsCount = (await database.all<{ count: number }>(sql`SELECT count(*) as count FROM auth_sessions`))[0].count;
    const preAccountsCount = (await database.all<{ count: number }>(sql`SELECT count(*) as count FROM auth_accounts`))[0].count;

    // 4. Create subset 0..0041 and migrate existing DB
    const subset0041Dir = join(tempDir, "drizzle-0041");
    createMigrationSubset(subset0041Dir, "0041_noisy_legion");
    await migrate(database, { migrationsFolder: subset0041Dir });

    // Verify row counts are preserved
    const postUsersCount = (await database.all<{ count: number }>(sql`SELECT count(*) as count FROM users`))[0].count;
    const postSessionsCount = (await database.all<{ count: number }>(sql`SELECT count(*) as count FROM auth_sessions`))[0].count;
    const postAccountsCount = (await database.all<{ count: number }>(sql`SELECT count(*) as count FROM auth_accounts`))[0].count;

    expect(postUsersCount).toBe(preUsersCount);
    expect(postSessionsCount).toBe(preSessionsCount);
    expect(postAccountsCount).toBe(preAccountsCount);

    // Foreign key integrity check post-migration
    const fkCheck = await database.all(sql`PRAGMA foreign_key_check`);
    expect(fkCheck).toEqual([]);

    // 5. Full snapshot assertions for session, ADMIN, and MANAGER
    const postSession = await database.query.authSessions.findFirst({
      where: (s, { eq }) => eq(s.id, "session-pre-cutover"),
    });

    expect(postSession).toBeDefined();
    expect(postSession?.token).toBe("secret-pre-cutover-token-xyz");
    expect(postSession?.userId).toBe("admin-cutover");
    expect(postSession?.lastActivityAt).toBeNull(); // Column added as NULL

    const postAdmin = await database.query.users.findFirst({
      where: (u, { eq }) => eq(u.id, "admin-cutover"),
    });
    expect(postAdmin).toMatchObject({
      id: "admin-cutover",
      shopId: "shop-main",
      email: "admin@example.test",
      role: "ADMIN",
      active: true,
    });

    const postManager = await database.query.users.findFirst({
      where: (u, { eq }) => eq(u.id, "manager-cutover"),
    });
    expect(postManager).toMatchObject({
      id: "manager-cutover",
      shopId: "shop-main",
      email: "manager@example.test",
      role: "MANAGER",
      active: true,
    });

    const postAdminAccount = await database.query.authAccounts.findFirst({
      where: (a, { eq }) => eq(a.id, "credential-admin-cutover"),
    });
    expect(postAdminAccount?.password).toBe(adminHash);
    expect(postAdminAccount?.accountId).toBe("admin-cutover");

    const postManagerAccount = await database.query.authAccounts.findFirst({
      where: (a, { eq }) => eq(a.id, "credential-manager-cutover"),
    });
    expect(postManagerAccount?.password).toBe(managerHash);
    expect(postManagerAccount?.accountId).toBe("manager-cutover");

    // 6. Run audit after migration
    const audit = await auditAuthReadiness(database, "shop-main", { strictSingleShop: true });
    expect(audit.ok).toBe(true);
    expect(audit.findings).toEqual([]);
  });
});
