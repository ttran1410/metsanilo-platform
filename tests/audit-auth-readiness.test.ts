import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createDatabaseConnection, type Database } from "@/db/client";
import { authAccounts, authSessions, authUsers, shops, users } from "@/db/schema";
import { hashPassword } from "@/domain/passwords";
import { resetEnvForTests } from "@/lib/env";
import { auditAuthReadiness, resolveAuditTarget } from "../scripts/audit-auth-readiness";

const directory = mkdtempSync(join(tmpdir(), "metsanilo-audit-readiness-"));
let database: Database;
let closeDatabase: () => void;
let sequence = 0;

beforeEach(async () => {
  sequence += 1;
  process.env.TURSO_DATABASE_URL = `file:${join(directory, `${sequence}.db`)}`;
  process.env.SHOP_ID = "shop-main";
  resetEnvForTests();
  const connection = createDatabaseConnection(process.env.TURSO_DATABASE_URL);
  database = connection.database;
  closeDatabase = connection.close;
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

afterEach(() => closeDatabase());
afterAll(() => rmSync(directory, { recursive: true, force: true }));

async function seedUserWithAuth(
  id: string,
  email: string,
  role: "ADMIN" | "MANAGER" | "STAFF",
  password = "Password123!",
  active = true,
  shopId = "shop-main"
) {
  const hash = hashPassword(password);
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
    mustChangePassword: false,
    temporaryPasswordIssuedAt: null,
    temporaryPasswordExpiresAt: null,
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
    id: `credential-${id}`,
    accountId: id,
    providerId: "credential",
    userId: id,
    password: hash,
    createdAt: now,
    updatedAt: now,
  });
}

describe("resolveAuditTarget", () => {
  it("defaults to local target", () => {
    const res = resolveAuditTarget([], { SHOP_ID: "shop-main", TURSO_DATABASE_URL: "file:local.db" });
    expect(res.target).toBe("local");
    expect(res.databaseUrl).toBe("file:local.db");
    expect(res.shopId).toBe("shop-main");
  });

  it("resolves explicit url flag with local file url", () => {
    const res = resolveAuditTarget(["--url=file:test.db", "--shop-id=shop-custom"], {});
    expect(res.target).toBe("explicit");
    expect(res.databaseUrl).toBe("file:test.db");
    expect(res.shopId).toBe("shop-custom");
  });

  it("rejects remote url passed via --url", () => {
    expect(() =>
      resolveAuditTarget(["--url=libsql://remote.turso.io"], {})
    ).toThrow(/Remote database URL cannot be audited via --url without --target=production/);
  });

  it("rejects combining --target=production and --url", () => {
    expect(() =>
      resolveAuditTarget(["--target=production", "--url=file:test.db"], {})
    ).toThrow(/Cannot combine --target=production with --url/);
  });

  it("rejects remote TURSO_DATABASE_URL when target is not production", () => {
    expect(() =>
      resolveAuditTarget([], { TURSO_DATABASE_URL: "libsql://remote.turso.io" })
    ).toThrow(/TURSO_DATABASE_URL points to a remote database, but target is not 'production'/);
  });

  it("rejects unknown arguments and invalid targets", () => {
    expect(() =>
      resolveAuditTarget(["--unknown-flag"], {})
    ).toThrow(/Unknown argument: --unknown-flag/);

    expect(() =>
      resolveAuditTarget(["--target=staging"], {})
    ).toThrow(/Invalid target: staging/);
  });

  it("resolves production target with remote url, auth token, and explicit SHOP_ID", () => {
    const res = resolveAuditTarget(["--target=production"], {
      TURSO_DATABASE_URL: "libsql://prod.turso.io",
      TURSO_AUTH_TOKEN: "secret-token",
      SHOP_ID: "shop-production-main",
    });
    expect(res.target).toBe("production");
    expect(res.databaseUrl).toBe("libsql://prod.turso.io");
    expect(res.authToken).toBe("secret-token");
    expect(res.shopId).toBe("shop-production-main");
  });

  it("throws when production target has file: url, missing token, or missing SHOP_ID", () => {
    expect(() =>
      resolveAuditTarget(["--target=production"], { TURSO_DATABASE_URL: "file:local.db" })
    ).toThrow(/Target is set to production but TURSO_DATABASE_URL is missing or local file URL/);

    expect(() =>
      resolveAuditTarget(["--target=production"], {
        TURSO_DATABASE_URL: "libsql://prod.turso.io",
        TURSO_AUTH_TOKEN: "",
        SHOP_ID: "shop-main",
      })
    ).toThrow(/Target is set to production but TURSO_AUTH_TOKEN is missing or empty/);

    expect(() =>
      resolveAuditTarget(["--target=production"], {
        TURSO_DATABASE_URL: "libsql://prod.turso.io",
        TURSO_AUTH_TOKEN: "token",
        SHOP_ID: "",
      })
    ).toThrow(/Target is set to production but SHOP_ID is not explicitly configured/);
  });
});

describe("auditAuthReadiness", () => {
  it("passes when active ADMIN and MANAGER have consistent Better Auth credentials", async () => {
    await seedUserWithAuth("admin-1", "admin@example.test", "ADMIN");
    await seedUserWithAuth("manager-1", "manager@example.test", "MANAGER");

    const result = await auditAuthReadiness(database, "shop-main");
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.findings).toEqual([]);
    expect(result.activeUsersCount).toBe(2);
    expect(result.adminCount).toBe(1);
    expect(result.managerCount).toBe(1);
  });

  it("fails if an active user lacks credential account", async () => {
    await seedUserWithAuth("admin-1", "admin@example.test", "ADMIN");
    const now = new Date();
    await database.insert(users).values({
      id: "manager-1",
      shopId: "shop-main",
      email: "manager@example.test",
      passwordHash: hashPassword("Password123!"),
      role: "MANAGER",
      active: true,
      displayName: "Manager",
      createdAt: now.toISOString(),
    });

    const result = await auditAuthReadiness(database, "shop-main");
    expect(result.ok).toBe(false);
    expect(result.findings.some((f) => f.code === "MISSING_AUTH_USER")).toBe(true);
    expect(result.findings.some((f) => f.code === "NO_CREDENTIAL_ACCOUNT")).toBe(true);
  });

  it("fails if an active user is missing password_hash credential mirror", async () => {
    await seedUserWithAuth("admin-1", "admin@example.test", "ADMIN");
    await seedUserWithAuth("manager-1", "manager@example.test", "MANAGER");
    // clear passwordHash
    await database.update(users).set({ passwordHash: "" }).where(eq(users.id, "manager-1"));

    const result = await auditAuthReadiness(database, "shop-main");
    expect(result.ok).toBe(false);
    expect(result.findings.some((f) => f.code === "MISSING_PASSWORD_HASH")).toBe(true);
  });

  it("fails if password hash is not valid Scrypt format", async () => {
    await seedUserWithAuth("admin-1", "admin@example.test", "ADMIN");
    await seedUserWithAuth("manager-1", "manager@example.test", "MANAGER");
    // set invalid hash format (e.g. bcrypt or argon2 or plain text)
    await database.update(users).set({ passwordHash: "invalid-hash" }).where(eq(users.id, "manager-1"));
    await database.update(authAccounts).set({ password: "invalid-hash" }).where(eq(authAccounts.userId, "manager-1"));

    const result = await auditAuthReadiness(database, "shop-main");
    expect(result.ok).toBe(false);
    expect(result.findings.some((f) => f.code === "INVALID_PASSWORD_HASH_FORMAT")).toBe(true);
    expect(result.findings.some((f) => f.code === "INVALID_CREDENTIAL_PASSWORD_FORMAT")).toBe(true);
  });

  it("fails if password hash contains leading or trailing whitespace", async () => {
    await seedUserWithAuth("admin-1", "admin@example.test", "ADMIN");
    await seedUserWithAuth("manager-1", "manager@example.test", "MANAGER");
    const validHash = hashPassword("Password123!");
    // add leading whitespace
    await database.update(users).set({ passwordHash: ` ${validHash}` }).where(eq(users.id, "manager-1"));
    await database.update(authAccounts).set({ password: ` ${validHash}` }).where(eq(authAccounts.userId, "manager-1"));

    const result = await auditAuthReadiness(database, "shop-main");
    expect(result.ok).toBe(false);
    expect(result.findings.some((f) => f.code === "INVALID_PASSWORD_HASH_FORMAT")).toBe(true);
  });

  it("fails if auth_accounts.account_id does not match users.id", async () => {
    await seedUserWithAuth("admin-1", "admin@example.test", "ADMIN");
    await seedUserWithAuth("manager-1", "manager@example.test", "MANAGER");
    // set mismatched account_id
    await database.update(authAccounts).set({ accountId: "wrong-account-id" }).where(eq(authAccounts.userId, "manager-1"));

    const result = await auditAuthReadiness(database, "shop-main");
    expect(result.ok).toBe(false);
    expect(result.findings.some((f) => f.code === "CREDENTIAL_ACCOUNT_ID_MISMATCH")).toBe(true);
  });

  it("passes readiness when temporary credential is structurally valid even if expired, incrementing metric", async () => {
    await seedUserWithAuth("admin-1", "admin@example.test", "ADMIN");
    await seedUserWithAuth("manager-1", "manager@example.test", "MANAGER");
    const pastIssued = new Date("2026-09-01T12:00:00.000Z").toISOString();
    const pastExpired = new Date("2026-09-02T12:00:00.000Z").toISOString();

    await database.update(users).set({
      mustChangePassword: true,
      temporaryPasswordIssuedAt: pastIssued,
      temporaryPasswordExpiresAt: pastExpired,
    }).where(eq(users.id, "manager-1"));

    const evalNow = new Date("2026-09-12T12:00:00.000Z");
    const result = await auditAuthReadiness(database, "shop-main", { now: evalNow });
    expect(result.ok).toBe(true);
    expect(result.findings).toEqual([]);
    expect(result.expiredTemporaryPasswordCount).toBe(1);
  });

  it("fails if orphan auth_user, auth_account, or session exists", async () => {
    await seedUserWithAuth("admin-1", "admin@example.test", "ADMIN");
    await seedUserWithAuth("manager-1", "manager@example.test", "MANAGER");

    const now = new Date();
    await database.insert(authUsers).values({
      id: "orphan-user",
      name: "Orphan",
      email: "orphan@example.test",
      createdAt: now,
      updatedAt: now,
    });
    await database.insert(authAccounts).values({
      id: "credential-orphan-user",
      accountId: "orphan-user",
      providerId: "credential",
      userId: "orphan-user",
      password: hashPassword("Pass123!"),
      createdAt: now,
      updatedAt: now,
    });
    await database.insert(authSessions).values({
      id: "orphan-session",
      userId: "orphan-user",
      token: "tok-1",
      expiresAt: new Date(now.getTime() + 3600000),
      createdAt: now,
      updatedAt: now,
    });

    const result = await auditAuthReadiness(database, "shop-main");
    expect(result.ok).toBe(false);
    expect(result.findings.some((f) => f.code === "ORPHAN_AUTH_USER")).toBe(true);
    expect(result.findings.some((f) => f.code === "ORPHAN_AUTH_ACCOUNT")).toBe(true);
    expect(result.findings.some((f) => f.code === "ORPHAN_SESSION")).toBe(true);
  });

  it("fails if there is no active MANAGER role", async () => {
    await seedUserWithAuth("admin-1", "admin@example.test", "ADMIN");

    const result = await auditAuthReadiness(database, "shop-main");
    expect(result.ok).toBe(false);
    expect(result.findings.some((f) => f.code === "NO_ACTIVE_MANAGER")).toBe(true);
  });

  it("strictSingleShop catches cross-shop auth records", async () => {
    await seedUserWithAuth("admin-1", "admin@example.test", "ADMIN");
    await seedUserWithAuth("manager-1", "manager@example.test", "MANAGER");

    // Add a user from another shop
    await database.insert(shops).values({
      id: "shop-other",
      slug: "other",
      nameFi: "Other",
      nameEn: "Other",
      timezone: "Europe/Helsinki",
      active: true,
      pickupNameFi: "Pickup",
      pickupNameEn: "Pickup",
      pickupAddress: "Test",
      pickupInstructionsFi: "Test",
      pickupInstructionsEn: "Test",
      pickupTime: "20:00",
    });
    await seedUserWithAuth("admin-2", "admin2@example.test", "ADMIN", "Password123!", true, "shop-other");

    // Without strictSingleShop (multi-shop/global inspection)
    const normalResult = await auditAuthReadiness(database, "shop-main", { strictSingleShop: false });
    expect(normalResult.ok).toBe(true);

    // With strictSingleShop (production single-shop assertion)
    const strictResult = await auditAuthReadiness(database, "shop-main", { strictSingleShop: true });
    expect(strictResult.ok).toBe(false);
    expect(strictResult.findings.some((f) => f.code === "CROSS_SHOP_AUTH_GRAPH")).toBe(true);
  });
});
