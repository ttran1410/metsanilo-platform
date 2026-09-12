import { mkdtempSync, rmSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { createDatabaseConnection, type Database } from "@/db/client";
import { authUsers } from "@/db/schema";

let closeDatabase: (() => void) | undefined;

afterEach(() => {
  closeDatabase?.();
  closeDatabase = undefined;
});

describe("Phase 4 session migration", () => {
  it("preserves a pre-existing auth session while adding nullable activity", async () => {
    const directory = mkdtempSync(join(tmpdir(), "metsanilo-phase4-migration-"));
    try {
      const connection = createDatabaseConnection(`file:${join(directory, "migration.db")}`);
      const database: Database = connection.database;
      closeDatabase = connection.close;

      const migrationFiles = readdirSync(join(process.cwd(), "drizzle"))
        .filter((file) => /^\d{4}_.*\.sql$/.test(file) && Number(file.slice(0, 4)) <= 40)
        .sort();
      for (const file of migrationFiles) {
        const statements = readFileSync(join(process.cwd(), "drizzle", file), "utf8")
          .split("--> statement-breakpoint")
          .map((statement) => statement.trim())
          .filter(Boolean);
        for (const statement of statements) await database.run(sql.raw(statement));
      }

      const createdAt = new Date("2026-09-12T12:00:00.000Z");
      await database.insert(authUsers).values({
        id: "migration-user",
        name: "Migration User",
        email: "migration-user@example.test",
        emailVerified: false,
        image: null,
        createdAt,
        updatedAt: createdAt,
      });
      await database.run(sql`
        INSERT INTO auth_sessions (id, expires_at, token, created_at, updated_at, ip_address, user_agent, user_id)
        VALUES (${"migration-session"}, ${new Date("2026-09-12T20:00:00.000Z").getTime()}, ${"migration-token"}, ${createdAt.getTime()}, ${createdAt.getTime()}, ${null}, ${"Migration Test"}, ${"migration-user"})
      `);

      const migration = readFileSync(join(process.cwd(), "drizzle", "0041_noisy_legion.sql"), "utf8");
      for (const statement of migration.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean)) {
        await database.run(sql.raw(statement));
      }

      const preserved = await database.query.authSessions.findFirst({ where: (session, operators) => operators.eq(session.id, "migration-session") });
      expect(preserved).toMatchObject({ id: "migration-session", userId: "migration-user", lastActivityAt: null });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
