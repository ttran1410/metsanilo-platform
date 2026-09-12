import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createDatabaseConnection, type Database } from "@/db/client";
import { authAccounts, authUsers, shops, users } from "@/db/schema";
import { hashPassword } from "@/domain/passwords";
import { resetEnvForTests } from "@/lib/env";
import { auditAuthReadiness } from "../scripts/audit-auth-readiness";

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
) {
  const hash = hashPassword(password);
  const now = new Date();
  await database.insert(users).values({
    id,
    shopId: "shop-main",
    email,
    username: email,
    displayName: email,
    passwordHash: hash,
    role,
    active,
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

describe("auditAuthReadiness", () => {
  it("passes when active ADMIN and MANAGER have consistent Better Auth credentials", async () => {
    await seedUserWithAuth("admin-1", "admin@example.test", "ADMIN");
    await seedUserWithAuth("manager-1", "manager@example.test", "MANAGER");

    const result = await auditAuthReadiness(database, "shop-main");
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
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
    expect(result.errors.some((e) => e.includes("missing auth_users"))).toBe(true);
    expect(result.errors.some((e) => e.includes("no Better Auth credential account"))).toBe(true);
  });

  it("fails if an active user is missing password_hash credential mirror", async () => {
    await seedUserWithAuth("admin-1", "admin@example.test", "ADMIN");
    await seedUserWithAuth("manager-1", "manager@example.test", "MANAGER");
    // clear passwordHash
    await database.update(users).set({ passwordHash: "" }).where(eq(users.id, "manager-1"));

    const result = await auditAuthReadiness(database, "shop-main");
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("missing passwordHash credential mirror"))).toBe(true);
  });

  it("fails if orphan auth_user or auth_account exists", async () => {
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

    const result = await auditAuthReadiness(database, "shop-main");
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("Orphan auth_user"))).toBe(true);
  });

  it("fails if there is no active MANAGER role", async () => {
    await seedUserWithAuth("admin-1", "admin@example.test", "ADMIN");

    const result = await auditAuthReadiness(database, "shop-main");
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("no active MANAGER user found"))).toBe(true);
  });
});
