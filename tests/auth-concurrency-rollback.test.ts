import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { resetDatabaseForTests, createDatabaseConnection, type Database } from "@/db/client";
import { users, authUsers, authAccounts, authSessions, auditEntries, shops } from "@/db/schema";
import { resetAdminUserPassword } from "@/domain/admin-user-actions";
import { hashPassword } from "@/domain/passwords";
import { resetEnvForTests } from "@/lib/env";
import { resetBetterAuthForTests } from "@/lib/better-auth";
import type { AdminActionContext } from "@/domain/admin-action-context";

const directory = mkdtempSync(join(tmpdir(), "metsanilo-concurrency-test-"));
let database: Database;
let closeDatabase: () => void;
let sequence = 0;

beforeEach(async () => {
  sequence += 1;
  process.env.TURSO_DATABASE_URL = `file:${join(directory, `concurrency-${sequence}.db`)}`;
  process.env.SHOP_ID = "shop-main";
  process.env.BETTER_AUTH_URL = "http://localhost:3000/api/auth/better";
  process.env.BETTER_AUTH_SECRET = "test-only-better-auth-secret-at-least-32-characters";
  resetEnvForTests();
  resetDatabaseForTests();
  resetBetterAuthForTests();
  const connection = createDatabaseConnection(process.env.TURSO_DATABASE_URL);
  database = connection.database;
  closeDatabase = connection.close;
  await migrate(database, { migrationsFolder: join(process.cwd(), "drizzle") });
  await database.insert(shops).values([
    { id: "shop-main", slug: "main", nameFi: "Pääkauppa", nameEn: "Main", timezone: "Europe/Helsinki", active: true, pickupNameFi: "Nouto", pickupNameEn: "Pickup", pickupAddress: "Test", pickupInstructionsFi: "Test", pickupInstructionsEn: "Test", pickupTime: "20:00" },
  ]);
});

afterAll(() => rmSync(directory, { recursive: true, force: true }));
afterEach(() => {
  resetDatabaseForTests();
  resetBetterAuthForTests();
  closeDatabase();
});

describe("Temporary Credential Concurrency and Transaction Rollback Integration", () => {
  it("handles concurrent password reset attempts with atomic sessionVersion increments and differentiated audit events", async () => {
    const now = new Date("2026-09-12T12:00:00.000Z");
    const initialHash = hashPassword("InitialPassword123!");

    await database.insert(users).values({
      id: "target-user-1",
      shopId: "shop-main",
      username: "target@example.test",
      email: "target@example.test",
      passwordHash: initialHash,
      mustChangePassword: false,
      sessionVersion: 1,
      displayName: "Target User",
      role: "STAFF",
      active: true,
      createdAt: now.toISOString(),
    });

    await database.insert(authUsers).values({
      id: "target-user-1",
      name: "Target User",
      email: "target@example.test",
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    });

    await database.insert(authAccounts).values({
      id: "acc-1",
      userId: "target-user-1",
      accountId: "target-user-1",
      providerId: "credential",
      password: initialHash,
      createdAt: now,
      updatedAt: now,
    });

    const adminContext: AdminActionContext = {
      shop: { id: "shop-main" },
      actor: { id: "admin-1", role: "ADMIN", shopId: "shop-main", email: "admin@example.test" },
    };

    // First reset: issues temporary password
    const firstReset = await resetAdminUserPassword(database, adminContext, "target-user-1", now);
    expect(firstReset.email).toBe("target@example.test");
    expect(firstReset.temporaryPassword).toBeDefined();

    const userAfterFirst = await database.query.users.findFirst({
      where: eq(users.id, "target-user-1"),
    });
    expect(userAfterFirst?.sessionVersion).toBe(2);
    expect(userAfterFirst?.mustChangePassword).toBe(true);

    // Second reset: regenerates temporary password and increments sessionVersion to 3
    const secondReset = await resetAdminUserPassword(database, adminContext, "target-user-1", new Date("2026-09-12T13:00:00.000Z"));
    expect(secondReset.temporaryPassword).toBeDefined();

    const userAfterSecond = await database.query.users.findFirst({
      where: eq(users.id, "target-user-1"),
    });
    expect(userAfterSecond?.sessionVersion).toBe(3);

    // Verify audit entries captured both issue and regenerate actions
    const audits = await database.select().from(auditEntries).where(eq(auditEntries.entityId, "target-user-1"));
    expect(audits).toHaveLength(2);
    expect(audits.map((a) => a.action)).toEqual([
      "user.temporary_password_issued",
      "user.temporary_password_regenerated",
    ]);
  });

  it("rolls back all changes atomically if audit entry write fails during resetAdminUserPassword", async () => {
    const now = new Date("2026-09-12T12:00:00.000Z");
    const initialHash = hashPassword("InitialPassword123!");

    await database.insert(users).values({
      id: "target-user-rollback",
      shopId: "shop-main",
      username: "target-rb@example.test",
      email: "target-rb@example.test",
      passwordHash: initialHash,
      mustChangePassword: false,
      sessionVersion: 1,
      displayName: "Target Rollback",
      role: "STAFF",
      active: true,
      createdAt: now.toISOString(),
    });

      await database.insert(authUsers).values({
        id: "target-user-rollback",
        name: "Target Rollback",
        email: "target-rb@example.test",
        emailVerified: false,
        createdAt: now,
        updatedAt: now,
      });

      await database.insert(authAccounts).values({
        id: "acc-rb",
        userId: "target-user-rollback",
        accountId: "target-user-rollback",
        providerId: "credential",
        password: initialHash,
        createdAt: now,
        updatedAt: now,
      });

      await database.insert(authSessions).values({
        id: "session-rb",
        userId: "target-user-rollback",
        token: "token-rb",
        expiresAt: new Date("2026-09-13T12:00:00.000Z"),
        createdAt: now,
        updatedAt: now,
      });

      const adminContext: AdminActionContext = {
        shop: { id: "shop-main" },
        actor: { id: "admin-1", role: "ADMIN", shopId: "shop-main", email: "admin@example.test" },
      };

    // Intercept transaction: cause error during audit insert
    const originalTransaction = database.transaction.bind(database);
    database.transaction = (async (callback: (tx: Parameters<Parameters<Database["transaction"]>[0]>[0]) => Promise<unknown>) => {
      return originalTransaction(async (tx) => {
        const originalInsert = tx.insert.bind(tx);
        tx.insert = ((table: unknown) => {
          if (table === auditEntries) {
            throw new Error("Simulated audit write failure");
          }
          return originalInsert(table as never);
        }) as typeof tx.insert;
        return callback(tx);
      });
    }) as typeof database.transaction;

    await expect(
      resetAdminUserPassword(database, adminContext, "target-user-rollback", now)
    ).rejects.toThrow("Simulated audit write failure");

    // Verify that user state rolled back completely
    const user = await database.query.users.findFirst({
      where: eq(users.id, "target-user-rollback"),
    });
    expect(user?.passwordHash).toBe(initialHash);
    expect(user?.mustChangePassword).toBe(false);
    expect(user?.temporaryPasswordIssuedAt).toBeNull();
    expect(user?.temporaryPasswordExpiresAt).toBeNull();
    expect(user?.sessionVersion).toBe(1);

    // Verify session was NOT revoked because transaction rolled back
    const sessions = await database.select().from(authSessions).where(eq(authSessions.userId, "target-user-rollback"));
    expect(sessions).toHaveLength(1);
  });

  it("enforces conflict 409 if rowsAffected !== 1 due to concurrent user deactivation", async () => {
    const now = new Date("2026-09-12T12:00:00.000Z");
    const initialHash = hashPassword("InitialPassword123!");

    await database.insert(users).values({
      id: "target-user-conflict",
      shopId: "shop-main",
      username: "target-cf@example.test",
      email: "target-cf@example.test",
      passwordHash: initialHash,
      mustChangePassword: false,
      sessionVersion: 1,
      displayName: "Target Conflict",
      role: "STAFF",
      active: true,
      createdAt: now.toISOString(),
    });

    const adminContext: AdminActionContext = {
      shop: { id: "shop-main" },
      actor: { id: "admin-1", role: "ADMIN", shopId: "shop-main", email: "admin@example.test" },
    };

    // Intercept transaction: deactivate user immediately before the update query executes
    const originalTransaction = database.transaction.bind(database);
    database.transaction = (async (callback: (tx: Parameters<Parameters<Database["transaction"]>[0]>[0]) => Promise<unknown>) => {
      return originalTransaction(async (tx) => {
        // Deactivate user in the database so rowsAffected will be 0
        await tx.update(users).set({ active: false }).where(eq(users.id, "target-user-conflict"));
        return callback(tx);
      });
    }) as typeof database.transaction;

    await expect(
      resetAdminUserPassword(database, adminContext, "target-user-conflict", now)
    ).rejects.toMatchObject({
      code: "CONFLICT",
      status: 409,
    });
  });
});
