import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createDatabaseConnection, type Database } from "@/db/client";
import { authAccounts, authUsers, shops } from "@/db/schema";
import { hashPassword } from "@/domain/passwords";

const directory = mkdtempSync(join(process.cwd(), ".tmp-contract-migration-"));
const migrationsFolder = join(directory, "drizzle-0041");
const databasePath = join(directory, "contract.db");
let database: Database;
let closeDatabase: () => void;

function createMigrationSubset() {
  mkdirSync(join(migrationsFolder, "meta"), { recursive: true });
  const journal = JSON.parse(readFileSync(join(process.cwd(), "drizzle/meta/_journal.json"), "utf8")) as {
    version: string;
    dialect: string;
    entries: Array<{ idx: number; version: string; when: number; tag: string; breakpoints: boolean; hash: string }>;
  };
  const entries = journal.entries.filter((entry) => entry.idx <= 41);
  writeFileSync(join(migrationsFolder, "meta/_journal.json"), JSON.stringify({ ...journal, entries }));
  for (const entry of entries) {
    copyFileSync(join(process.cwd(), "drizzle", `${entry.tag}.sql`), join(migrationsFolder, `${entry.tag}.sql`));
  }
}

beforeAll(async () => {
  createMigrationSubset();
  const connection = createDatabaseConnection(`file:${databasePath}`);
  database = connection.database;
  closeDatabase = connection.close;
  await migrate(database, { migrationsFolder });
  await database.insert(shops).values({ id: "shop-main", slug: "main", nameFi: "Main", nameEn: "Main", timezone: "Europe/Helsinki", active: true, pickupNameFi: "Pickup", pickupNameEn: "Pickup", pickupAddress: "Test", pickupInstructionsFi: "Test", pickupInstructionsEn: "Test", pickupTime: "20:00" });
});

afterAll(() => {
  closeDatabase();
  rmSync(directory, { recursive: true, force: true });
});

describe("Better Auth contract migration", () => {
  it("runs Release B reads against physical schema 0041, preserves data, and applies 0042", async () => {
    const password = hashPassword("Password123!");
    await database.run(sql`INSERT INTO users (id, shop_id, username, email, password_hash, must_change_password, session_version, display_name, role, active, created_at) VALUES ('contract-user', 'shop-main', 'contract-user', 'contract@example.test', ${password}, 1, 7, 'Contract User', 'MANAGER', 1, '2026-09-13T10:00:00.000Z')`);
    await database.insert(authUsers).values({ id: "contract-user", name: "Contract User", email: "contract@example.test", emailVerified: false, createdAt: new Date(), updatedAt: new Date() });
    await database.insert(authAccounts).values({ id: "credential-contract-user", accountId: "contract-user", providerId: "credential", userId: "contract-user", password, createdAt: new Date(), updatedAt: new Date() });

    await expect(database.query.users.findFirst({ where: (u, { eq }) => eq(u.id, "contract-user") })).resolves.toMatchObject({ username: "contract-user", role: "MANAGER" });

    const before = await database.all(sql`SELECT id, shop_id, username, email, must_change_password, temporary_password_issued_at, temporary_password_expires_at, display_name, role, active, created_at FROM users`);
    const currentMigrationFiles = readdirSync(join(process.cwd(), "drizzle")).filter((file) => file.startsWith("0042_"));
    expect(currentMigrationFiles).toHaveLength(1);
    await migrate(database, { migrationsFolder: join(process.cwd(), "drizzle") });

    const columns = await database.all(sql`PRAGMA table_info(users)`);
    const names = columns.map((column) => String((column as { name: string }).name));
    expect(names).not.toContain("password_hash");
    expect(names).not.toContain("session_version");
    expect(names).toEqual(expect.arrayContaining(["id", "shop_id", "username", "email", "must_change_password", "temporary_password_issued_at", "temporary_password_expires_at", "display_name", "role", "active", "created_at"]));
    await expect(database.all(sql`SELECT id, shop_id, username, email, must_change_password, temporary_password_issued_at, temporary_password_expires_at, display_name, role, active, created_at FROM users`)).resolves.toEqual(before);
    await expect(database.all(sql`PRAGMA foreign_key_check`)).resolves.toHaveLength(0);
    const indexes = await database.all(sql`PRAGMA index_list(users)`);
    expect(indexes.some((index) => String((index as { name: string }).name) === "users_email_unique")).toBe(true);
  });
});
