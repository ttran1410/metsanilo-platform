import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createDatabaseConnection, type Database } from "@/db/client";
import { resetDatabaseForTests } from "@/db/client";
import { auditEntries, authAccounts, authSessions, authUsers, shops, users } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/domain/passwords";
import { resetEnvForTests } from "@/lib/env";
import { runAuthCutoverCanary } from "../scripts/auth-cutover-canary";
import { createBetterAuthInstance } from "@/lib/better-auth";
import { GET as getSession } from "@/app/api/auth/session/route";
import { GET as getAdminUsers } from "@/app/api/admin/users/route";

const directory = mkdtempSync(join(tmpdir(), "metsanilo-canary-test-"));
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
  resetDatabaseForTests();
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

describe("runAuthCutoverCanary", () => {
  it("runs the HTTP canary path and rejects the old cookie after cutover", async () => {
    await seedUserWithAuth("admin-1", "admin@example.test", "ADMIN", 1);
    await seedUserWithAuth("canary-mgr", "canary@example.test", "MANAGER", 1);
    await seedUserWithAuth("mgr-secondary", "secondary-mgr@example.test", "MANAGER", 1);

    let loginCount = 0;
    const auth = createBetterAuthInstance({ database });
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      if (url.endsWith("/api/auth/better/sign-in/email")) {
        loginCount += 1;
        return auth.handler(new Request(url, init));
      }

      const request = new Request(url, init);
      if (url.endsWith("/api/auth/session")) return getSession(request);
      if (url.endsWith("/api/admin/users")) return getAdminUsers(request);
      return new Response("Not found", { status: 404 });
    };

    const result = await runAuthCutoverCanary(database, {
      shopId: "shop-main",
      canaryUserId: "canary-mgr",
      releaseSha: "abcdef1234567890abcdef1234567890abcdef12",
      canaryPassword: "Password123!",
      baseUrl: "http://localhost:3000",
      fetchImpl,
    });

    expect(result.preCutoverSessionInvalidated).toBe(true);
    expect(result.postCutoverReLoginSucceeded).toBe(true);
    expect(loginCount).toBe(2);
    expect(await database.query.authSessions.findMany({ where: eq(authSessions.userId, "canary-mgr") })).toHaveLength(0);
  });

  it("runs full canary flow: pre-cutover invalidation, post-cutover re-login, credential rotation", async () => {
    await seedUserWithAuth("admin-1", "admin@example.test", "ADMIN", 1);
    await seedUserWithAuth("canary-mgr", "canary@example.test", "MANAGER", 1);
    await seedUserWithAuth("mgr-secondary", "secondary-mgr@example.test", "MANAGER", 1);

    const result = await runAuthCutoverCanary(database, {
      shopId: "shop-main",
      canaryUserId: "canary-mgr",
      releaseSha: "abcdef1234567890abcdef1234567890abcdef12",
      finalCanaryPassword: "FinalCanary123!",
    });

    expect(result.ok).toBe(true);
    expect(result.preCutoverSessionInvalidated).toBe(true);
    expect(result.postCutoverReLoginSucceeded).toBe(true);
    expect(result.canaryRotatedAuditId).toBeDefined();

    // Verify rotation audit is in database
    const rotationAudit = await database.query.auditEntries.findFirst({
      where: and(eq(auditEntries.shopId, "shop-main"), eq(auditEntries.action, "auth.canary_rotated")),
    });
    expect(rotationAudit).toBeDefined();
    const rotatedAccount = await database.query.authAccounts.findFirst({ where: eq(authAccounts.userId, "canary-mgr") });
    expect(rotatedAccount?.password).toBeDefined();
    expect(verifyPassword("FinalCanary123!", rotatedAccount!.password!)).toBe(true);
  });

  it("fails early if canary user is not MANAGER or is inactive", async () => {
    await seedUserWithAuth("admin-1", "admin@example.test", "ADMIN", 1);
    await seedUserWithAuth("mgr-secondary", "secondary-mgr@example.test", "MANAGER", 1);
    await seedUserWithAuth("staff-user", "staff@example.test", "STAFF", 1);

    await expect(
      runAuthCutoverCanary(database, {
        shopId: "shop-main",
        canaryUserId: "staff-user",
        releaseSha: "rel-1",
      })
    ).rejects.toThrow(/INVALID_CANARY_ACCOUNT/);
  });

  it("fails early if shop has fewer than 2 active MANAGER accounts", async () => {
    await seedUserWithAuth("admin-1", "admin@example.test", "ADMIN", 1);
    await seedUserWithAuth("canary-mgr", "canary@example.test", "MANAGER", 1);

    await expect(
      runAuthCutoverCanary(database, {
        shopId: "shop-main",
        canaryUserId: "canary-mgr",
        releaseSha: "rel-1",
      })
    ).rejects.toThrow(/CANARY_PRECHECK_FAILED.*at least 2 are required/);
  });

  it("fails early if canary account is the bootstrap admin", async () => {
    process.env.ADMIN_BOOTSTRAP_USERNAME = "canary@example.test";
    await seedUserWithAuth("canary-mgr", "canary@example.test", "MANAGER", 1);
    await seedUserWithAuth("mgr-secondary", "secondary-mgr@example.test", "MANAGER", 1);

    await expect(
      runAuthCutoverCanary(database, {
        shopId: "shop-main",
        canaryUserId: "canary-mgr",
        releaseSha: "rel-1",
      })
    ).rejects.toThrow(/CANARY_PRECHECK_FAILED.*cannot be the bootstrap admin account/);

    delete process.env.ADMIN_BOOTSTRAP_USERNAME;
  });

  it("fails early with exitCode 2 in production mode if RELEASE_PREFLIGHT is not true", async () => {
    await seedUserWithAuth("admin-1", "admin@example.test", "ADMIN", 1);
    await seedUserWithAuth("canary-mgr", "canary@example.test", "MANAGER", 1);
    await seedUserWithAuth("mgr-secondary", "secondary-mgr@example.test", "MANAGER", 1);

    await expect(
      runAuthCutoverCanary(database, {
        shopId: "shop-main",
        canaryUserId: "canary-mgr",
        releaseSha: "rel-1",
        target: "production",
      })
    ).rejects.toThrow(/CANARY_PRECHECK_FAILED.*RELEASE_PREFLIGHT=true/);
  });

  it("sets exit code 8 if canary credential revocation fails in finally block", async () => {
    await seedUserWithAuth("admin-1", "admin@example.test", "ADMIN", 1);
    await seedUserWithAuth("canary-mgr", "canary@example.test", "MANAGER", 1);
    await seedUserWithAuth("mgr-secondary", "secondary-mgr@example.test", "MANAGER", 1);

    try {
      await runAuthCutoverCanary(database, {
        shopId: "shop-main",
        canaryUserId: "canary-mgr",
        releaseSha: "rel-1",
        testHooks: {
          failCanaryCredentialRevocation: true,
        },
      });
      expect.unreachable("Should have thrown");
    } catch (err: unknown) {
      const error = err as Error & { exitCode?: number };
      expect(error.message).toContain("CANARY_CREDENTIAL_REVOCATION_FAILED");
      expect(error.exitCode).toBe(8);
    }
  });

  it("sets exit code 7 if canary session cleanup fails in finally block", async () => {
    await seedUserWithAuth("admin-1", "admin@example.test", "ADMIN", 1);
    await seedUserWithAuth("canary-mgr", "canary@example.test", "MANAGER", 1);
    await seedUserWithAuth("mgr-secondary", "secondary-mgr@example.test", "MANAGER", 1);

    try {
      await runAuthCutoverCanary(database, {
        shopId: "shop-main",
        canaryUserId: "canary-mgr",
        releaseSha: "rel-1",
        testHooks: {
          failCanarySessionCleanup: true,
        },
      });
      expect.unreachable("Should have thrown");
    } catch (err: unknown) {
      const error = err as Error & { exitCode?: number };
      expect(error.message).toContain("CANARY_CLEANUP_FAILED");
      expect(error.exitCode).toBe(7);
    }
  });

  it("cleans up sessions and rotates canary credentials when cutover fails", async () => {
    await seedUserWithAuth("admin-1", "admin@example.test", "ADMIN", 1);
    await seedUserWithAuth("canary-mgr", "canary@example.test", "MANAGER", 1);
    await seedUserWithAuth("mgr-secondary", "secondary-mgr@example.test", "MANAGER", 1);

    await expect(
      runAuthCutoverCanary(database, {
        shopId: "shop-main",
        canaryUserId: "canary-mgr",
        releaseSha: "rel-1",
        testHooks: {
          simulateCutoverFailure: true,
        },
      })
    ).rejects.toThrow(/Simulated cutover failure/);

    // Assert canary credentials rotated even on failure
    const rotationAudit = await database.query.auditEntries.findFirst({
      where: and(eq(auditEntries.shopId, "shop-main"), eq(auditEntries.action, "auth.canary_rotated")),
    });
    expect(rotationAudit).toBeDefined();

    // Assert sessions revoked
    const sessions = await database.query.authSessions.findMany({
      where: eq(authSessions.userId, "canary-mgr"),
    });
    expect(sessions.length).toBe(0);
  });
});
