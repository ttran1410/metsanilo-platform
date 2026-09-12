import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq, sql } from "drizzle-orm";
import { createDatabaseConnection, type Database } from "@/db/client";
import { authAccounts, authUsers, shops, users } from "@/db/schema";
import { hashPassword } from "@/domain/passwords";
import { reconcileBootstrapAdmin } from "@/lib/auth-integration";
import { resetEnvForTests } from "@/lib/env";

const directory = mkdtempSync(join(tmpdir(), "metsanilo-seed-auth-"));
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
  await database.insert(shops).values({ id: "shop-main", slug: "main", nameFi: "Main", nameEn: "Main", timezone: "Europe/Helsinki", active: true, pickupNameFi: "Pickup", pickupNameEn: "Pickup", pickupAddress: "Test", pickupInstructionsFi: "Test", pickupInstructionsEn: "Test", pickupTime: "20:00" });
});
afterEach(() => closeDatabase());
afterAll(() => rmSync(directory, { recursive: true, force: true }));

const input = (overrides = {}) => ({ id: "user-shop-main-admin", shopId: "shop-main", email: "admin@example.test", displayName: "Shop admin", passwordHash: hashPassword("Password123!"), now: new Date("2026-01-01T00:00:00.000Z"), ...overrides });

describe("seed Better Auth reconciliation", () => {
  it("provisions all identities on a fresh database", async () => {
    await reconcileBootstrapAdmin(database, input());
    expect(await database.select().from(users)).toHaveLength(1);
    expect(await database.select().from(authUsers)).toHaveLength(1);
    expect(await database.select().from(authAccounts)).toHaveLength(1);
    expect((await database.select().from(authUsers))[0].emailVerified).toBe(false);
  });

  it("is idempotent and updates the deterministic seed state while preserving immutable email", async () => {
    await reconcileBootstrapAdmin(database, input());
    await reconcileBootstrapAdmin(database, input({ displayName: "Updated admin", passwordHash: hashPassword("NewPassword123!") }));
    expect(await database.select().from(users)).toHaveLength(1);
    expect(await database.query.users.findFirst({ where: eq(users.id, input().id) })).toMatchObject({ email: "admin@example.test", displayName: "Updated admin" });
  });

  it("fails preflight and rejects email change during seed rerun", async () => {
    await reconcileBootstrapAdmin(database, input());
    await expect(
      reconcileBootstrapAdmin(database, input({ email: "changed-email@example.test" }))
    ).rejects.toThrow(/email is immutable/);
    expect(await database.query.users.findFirst({ where: eq(users.id, input().id) })).toMatchObject({ email: "admin@example.test" });
  });

  it("repairs a partial identity missing its credential account", async () => {
    const value = input();
    await database.insert(users).values({ id: value.id, shopId: value.shopId, username: value.email, email: value.email, passwordHash: value.passwordHash, mustChangePassword: false, sessionVersion: 1, displayName: value.displayName, role: "ADMIN", active: true, createdAt: value.now.toISOString() });
    await database.insert(authUsers).values({ id: value.id, name: value.displayName, email: value.email, emailVerified: true, createdAt: value.now, updatedAt: value.now });
    await reconcileBootstrapAdmin(database, value);
    expect(await database.select().from(authAccounts)).toHaveLength(1);
    expect((await database.select().from(authUsers))[0].emailVerified).toBe(false);
  });

  it("rolls back the user upsert when the auth email conflicts", async () => {
    const value = input();
    await database.insert(users).values({ id: value.id, shopId: value.shopId, username: "old@example.test", email: "old@example.test", passwordHash: value.passwordHash, mustChangePassword: false, sessionVersion: 1, displayName: "Old", role: "ADMIN", active: true, createdAt: value.now.toISOString() });
    await database.insert(authUsers).values({ id: "other", name: "Other", email: value.email, emailVerified: false, createdAt: value.now, updatedAt: value.now });
    await expect(reconcileBootstrapAdmin(database, value)).rejects.toThrow();
    expect(await database.query.users.findFirst({ where: eq(users.id, value.id) })).toMatchObject({ email: "old@example.test", displayName: "Old" });
  });

  it("rolls back users and auth users when the credential write fails", async () => {
    const value = input();
    await database.run(sql`CREATE TRIGGER fail_seed_auth_account BEFORE INSERT ON auth_accounts BEGIN SELECT RAISE(ABORT, 'injected auth account failure'); END`);
    try {
      await expect(reconcileBootstrapAdmin(database, value)).rejects.toThrow();
    } finally {
      await database.run(sql`DROP TRIGGER fail_seed_auth_account`);
    }
    expect(await database.query.users.findFirst({ where: eq(users.id, value.id) })).toBeUndefined();
    expect(await database.query.authUsers.findFirst({ where: eq(authUsers.id, value.id) })).toBeUndefined();
    expect(await database.query.authAccounts.findFirst({ where: eq(authAccounts.id, `credential-${value.id}`) })).toBeUndefined();
  });
});
