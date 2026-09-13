import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createDatabaseConnection, type Database } from "@/db/client";
import { auditEntries, authAccounts, authSessions, authUsers, shops, users } from "@/db/schema";
import { hashPassword } from "@/domain/passwords";
import { resetEnvForTests } from "@/lib/env";
import {
  runAuthCutover,
  isValidShopCutoverMarker,
} from "../scripts/cutover-auth";

const directory = mkdtempSync(join(tmpdir(), "metsanilo-cutover-test-"));
let database: Database;
let closeDatabase: () => void;
let sequence = 0;

beforeEach(async () => {
  sequence += 1;
  const dbUrl = `file:${join(directory, `${sequence}.db`)}`;
  process.env.TURSO_DATABASE_URL = dbUrl;
  process.env.SHOP_ID = "shop-main";
  resetEnvForTests();

  const conn = createDatabaseConnection(dbUrl);
  database = conn.database;
  closeDatabase = conn.close;

  await migrate(database, { migrationsFolder: join(process.cwd(), "drizzle") });

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
});

afterEach(() => {
  closeDatabase();
});

afterAll(() => {
  rmSync(directory, { recursive: true, force: true });
});

async function seedUserWithAuth(
  id: string,
  email: string,
  role: "ADMIN" | "MANAGER" | "STAFF",
  sessionVersion = 1,
  active = true,
  shopId = "shop-main"
) {
  const hash = hashPassword("Password123!");
  const now = new Date();
  await database.insert(users).values({
    id,
    shopId,
    email,
    username: email,
    displayName: email,
    passwordHash: hash,
    role,
    active,
    sessionVersion,
    mustChangePassword: false,
    createdAt: now.toISOString(),
  });
  await database.insert(authUsers).values({
    id,
    name: email,
    email,
    createdAt: now,
    updatedAt: now,
  });
  await database.insert(authAccounts).values({
    id: `cred-${id}`,
    accountId: id,
    providerId: "credential",
    userId: id,
    password: hash,
    createdAt: now,
    updatedAt: now,
  });
}

describe("runAuthCutover", () => {
  it("executes successful cutover, invalidates sessions, increments session_version, and records audits", async () => {
    await seedUserWithAuth("admin-1", "admin@example.test", "ADMIN", 1);
    await seedUserWithAuth("manager-1", "manager@example.test", "MANAGER", 1);

    // Create active sessions
    const now = new Date();
    await database.insert(authSessions).values([
      {
        id: "sess-1",
        userId: "admin-1",
        token: "tok-1",
        expiresAt: new Date(now.getTime() + 3600000),
        createdAt: now,
        updatedAt: now,
        lastActivityAt: now,
      },
      {
        id: "sess-2",
        userId: "manager-1",
        token: "tok-2",
        expiresAt: new Date(now.getTime() + 3600000),
        createdAt: now,
        updatedAt: now,
        lastActivityAt: now,
      },
    ]);

    const result = await runAuthCutover(database, {
      shopId: "shop-main",
      releaseSha: "abcdef1234567890abcdef1234567890abcdef12",
    });

    expect(result.status).toBe("COMMITTED");
    expect(result.totalSessionsDeletedCount).toBe(2);
    expect(result.updatedUsersCount).toBe(2);

    // Assert sessions deleted
    const remainingSessions = await database.query.authSessions.findMany();
    expect(remainingSessions.length).toBe(0);

    // Assert users session_version incremented
    const adminUser = await database.query.users.findFirst({ where: eq(users.id, "admin-1") });
    const managerUser = await database.query.users.findFirst({ where: eq(users.id, "manager-1") });
    expect(adminUser?.sessionVersion).toBe(2);
    expect(managerUser?.sessionVersion).toBe(2);

    // Assert primary marker and release marker exist
    const shopMarker = await database.query.auditEntries.findFirst({
      where: eq(auditEntries.id, "audit:cutover:shop-main"),
    });
    expect(shopMarker).toBeDefined();
    expect(isValidShopCutoverMarker(shopMarker, "shop-main")).toBe(true);

    const releaseMarker = await database.query.auditEntries.findFirst({
      where: eq(auditEntries.id, "audit:cutover:shop-main:abcdef1234567890abcdef1234567890abcdef12"),
    });
    expect(releaseMarker).toBeDefined();

    // Assert mutex lock is deleted
    const lock = await database.query.auditEntries.findFirst({
      where: eq(auditEntries.id, "lock:auth-cutover:shop-main"),
    });
    expect(lock).toBeUndefined();
  });

  it("enforces single cutover guard and returns ALREADY_EXECUTED on subsequent runs", async () => {
    await seedUserWithAuth("admin-1", "admin@example.test", "ADMIN", 1);
    await seedUserWithAuth("manager-1", "manager@example.test", "MANAGER", 1);

    const firstResult = await runAuthCutover(database, {
      shopId: "shop-main",
      releaseSha: "release-sha-1",
    });
    expect(firstResult.status).toBe("COMMITTED");

    // Second run without allowRepeatCutover
    const secondResult = await runAuthCutover(database, {
      shopId: "shop-main",
      releaseSha: "release-sha-2",
    });
    expect(secondResult.status).toBe("ALREADY_EXECUTED");
    expect(secondResult.runId).toBe(firstResult.runId);

    // Version should not be incremented again
    const adminUser = await database.query.users.findFirst({ where: eq(users.id, "admin-1") });
    expect(adminUser?.sessionVersion).toBe(2);
  });

  it("permits repeat cutover when explicit allowRepeatCutover and ownerApprovalReference are provided", async () => {
    await seedUserWithAuth("admin-1", "admin@example.test", "ADMIN", 1);
    await seedUserWithAuth("manager-1", "manager@example.test", "MANAGER", 1);

    await runAuthCutover(database, {
      shopId: "shop-main",
      releaseSha: "release-sha-1",
    });

    const repeatResult = await runAuthCutover(database, {
      shopId: "shop-main",
      releaseSha: "release-sha-2",
      allowRepeatCutover: true,
      ownerApprovalReference: "INC-999-EMERGENCY-RESET",
    });

    expect(repeatResult.status).toBe("COMMITTED");

    const adminUser = await database.query.users.findFirst({ where: eq(users.id, "admin-1") });
    expect(adminUser?.sessionVersion).toBe(3);

    const repeatMarker = await database.query.auditEntries.findFirst({
      where: eq(auditEntries.id, `audit:cutover:shop-main:${repeatResult.runId}`),
    });
    expect(repeatMarker).toBeDefined();
    expect(repeatMarker?.action).toBe("auth.cutover_repeat");
  });

  it("rejects repeat cutover if ownerApprovalReference is missing or invalid", async () => {
    await seedUserWithAuth("admin-1", "admin@example.test", "ADMIN", 1);
    await seedUserWithAuth("manager-1", "manager@example.test", "MANAGER", 1);

    await runAuthCutover(database, {
      shopId: "shop-main",
      releaseSha: "release-sha-1",
    });

    await expect(
      runAuthCutover(database, {
        shopId: "shop-main",
        releaseSha: "release-sha-2",
        allowRepeatCutover: true,
        ownerApprovalReference: "",
      })
    ).rejects.toThrow(/REPEAT_CUTOVER_REQUIRES_OWNER_APPROVAL/);
  });

  it("rejects corrupted cutover marker with CUTOVER_MARKER_INVALID", async () => {
    await seedUserWithAuth("admin-1", "admin@example.test", "ADMIN", 1);
    await seedUserWithAuth("manager-1", "manager@example.test", "MANAGER", 1);

    // Insert malformed marker
    await database.insert(auditEntries).values({
      id: "audit:cutover:shop-main",
      shopId: "shop-main",
      actor: "system",
      action: "auth.cutover_executed",
      entityType: "system",
      entityId: "auth-cutover",
      detailsJson: "not-json",
      createdAt: new Date().toISOString(),
    });

    await expect(
      runAuthCutover(database, {
        shopId: "shop-main",
        releaseSha: "release-sha-1",
      })
    ).rejects.toThrow(/CUTOVER_MARKER_INVALID/);
  });

  it("rejects concurrent cutover attempt when active lock exists", async () => {
    await seedUserWithAuth("admin-1", "admin@example.test", "ADMIN", 1);
    await seedUserWithAuth("manager-1", "manager@example.test", "MANAGER", 1);

    // Insert active lock (< 15 mins old)
    await database.insert(auditEntries).values({
      id: "lock:auth-cutover:shop-main",
      shopId: "shop-main",
      actor: "system",
      action: "auth.cutover_in_progress",
      entityType: "system",
      entityId: "auth-cutover",
      detailsJson: JSON.stringify({
        shopId: "shop-main",
        runId: "concurrent-run",
        lockedAt: new Date().toISOString(),
      }),
      createdAt: new Date().toISOString(),
    });

    await expect(
      runAuthCutover(database, {
        shopId: "shop-main",
        releaseSha: "release-sha-1",
      })
    ).rejects.toThrow(/CONCURRENT_EXECUTION_REJECTED/);
  });

  it("recovers stale lock (> 15 mins old), records recovery audit, and executes successfully", async () => {
    await seedUserWithAuth("admin-1", "admin@example.test", "ADMIN", 1);
    await seedUserWithAuth("manager-1", "manager@example.test", "MANAGER", 1);

    const staleTime = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    await database.insert(auditEntries).values({
      id: "lock:auth-cutover:shop-main",
      shopId: "shop-main",
      actor: "system",
      action: "auth.cutover_in_progress",
      entityType: "system",
      entityId: "auth-cutover",
      detailsJson: JSON.stringify({
        shopId: "shop-main",
        runId: "stale-run",
        lockedAt: staleTime,
      }),
      createdAt: staleTime,
    });

    const result = await runAuthCutover(database, {
      shopId: "shop-main",
      releaseSha: "release-sha-1",
    });

    expect(result.status).toBe("COMMITTED");

    // Check recovery audit
    const recoveryAudit = await database.query.auditEntries.findFirst({
      where: and(eq(auditEntries.shopId, "shop-main"), eq(auditEntries.action, "auth.cutover_lock_recovered")),
    });
    expect(recoveryAudit).toBeDefined();
  });

  it("rolls back transaction and cleans lock if readiness validation fails", async () => {
    // Missing active MANAGER role -> readiness will fail
    await seedUserWithAuth("admin-1", "admin@example.test", "ADMIN", 1);

    await expect(
      runAuthCutover(database, {
        shopId: "shop-main",
        releaseSha: "release-sha-1",
      })
    ).rejects.toThrow(/VALIDATION_FAILED/);

    // Mutex lock should be cleaned up
    const lock = await database.query.auditEntries.findFirst({
      where: eq(auditEntries.id, "lock:auth-cutover:shop-main"),
    });
    expect(lock).toBeUndefined();

    // No cutover marker
    const marker = await database.query.auditEntries.findFirst({
      where: eq(auditEntries.id, "audit:cutover:shop-main"),
    });
    expect(marker).toBeUndefined();
  });

  it("wraps error with ROLLBACK_LOCK_CLEANUP_PENDING if rollback lock cleanup fails", async () => {
    await seedUserWithAuth("admin-1", "admin@example.test", "ADMIN", 1);

    await expect(
      runAuthCutover(database, {
        shopId: "shop-main",
        releaseSha: "release-sha-1",
        testHooks: {
          failRollbackLockCleanup: true,
        },
      })
    ).rejects.toThrow(/ROLLBACK_LOCK_CLEANUP_PENDING/);
  });

  it("throws COMMITTED_LOCK_CLEANUP_PENDING if post-commit lock cleanup fails", async () => {
    await seedUserWithAuth("admin-1", "admin@example.test", "ADMIN", 1);
    await seedUserWithAuth("manager-1", "manager@example.test", "MANAGER", 1);

    await expect(
      runAuthCutover(database, {
        shopId: "shop-main",
        releaseSha: "release-sha-1",
        testHooks: {
          failPostCommitLockCleanup: true,
        },
      })
    ).rejects.toThrow(/COMMITTED_LOCK_CLEANUP_PENDING/);
  });
});
