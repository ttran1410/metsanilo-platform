import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createDatabaseConnection } from "@/db/client";
import * as schema from "@/db/schema";
import { shops } from "@/db/schema";
import { reconcileBootstrapAdmin } from "@/lib/auth-integration";
import { hashPassword } from "@/domain/passwords";
import { auditAuthReadiness, type AuditReadinessResult } from "./audit-auth-readiness";

export type RehearsalOptions = {
  shopId?: string;
  adminEmail?: string;
  adminPassword?: string;
  preserveTempDb?: boolean;
};

export type RehearsalResult = {
  ok: boolean;
  databasePath: string;
  auditResult: AuditReadinessResult;
  cleanup: () => void;
};

export async function runAuthCutoverRehearsal(
  options: RehearsalOptions = {}
): Promise<RehearsalResult> {
  const shopId = options.shopId ?? "shop-main";
  const adminEmail = options.adminEmail ?? "admin@metsanilo.test";
  const adminPassword = options.adminPassword ?? "Metsanilo2026!Admin";

  const tempDir = mkdtempSync(join(tmpdir(), "metsanilo-auth-rehearsal-"));
  const dbPath = join(tempDir, "rehearsal.db");
  const dbUrl = `file:${dbPath}`;

  const connection = createDatabaseConnection(dbUrl);
  const database = connection.database;

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    try {
      connection.close();
    } catch {
      // Ignore close errors
    }
    if (!options.preserveTempDb) {
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore rm errors
      }
    }
  };

  try {
    // 1. Run migrations from drizzle folder
    await migrate(database, { migrationsFolder: join(process.cwd(), "drizzle") });

    // 2. Ensure default shop exists
    const existingShop = await database.query.shops.findFirst({
      where: (s, { eq }) => eq(s.id, shopId),
    });

    if (!existingShop) {
      await database.insert(shops).values({
        id: shopId,
        slug: "main",
        nameFi: "Metsänilo Pääkauppa",
        nameEn: "Metsänilo Main Shop",
        timezone: "Europe/Helsinki",
        active: true,
        pickupNameFi: "Noutopiste",
        pickupNameEn: "Pickup Point",
        pickupAddress: "Helsinki",
        pickupInstructionsFi: "Ohjeet",
        pickupInstructionsEn: "Instructions",
        pickupTime: "18:00",
      });
    }

    // 3. Ensure Bootstrap Admin identity exists and is synced
    await reconcileBootstrapAdmin(database, {
      id: "admin-bootstrap-rehearsal",
      shopId,
      email: adminEmail,
      displayName: "Bootstrap Admin (Rehearsal)",
      hashedPassword: hashPassword(adminPassword),
    });

    // 4. Seed an active MANAGER identity if missing for audit coverage
    const existingManager = await database.query.users.findFirst({
      where: (u, { and, eq }) => and(eq(u.shopId, shopId), eq(u.role, "MANAGER"), eq(u.active, true)),
    });

    if (!existingManager) {
      const now = new Date();
      const managerId = "manager-rehearsal";
      const managerHash = hashPassword("Manager2026!Pass");

      await database.transaction(async (tx) => {
        await tx.insert(schema.users).values({
          id: managerId,
          shopId,
          email: "manager@metsanilo.test",
          username: "manager@metsanilo.test",
          displayName: "Rehearsal Manager",
          role: "MANAGER",
          active: true,
          mustChangePassword: false,
          temporaryPasswordIssuedAt: null,
          temporaryPasswordExpiresAt: null,
          createdAt: now.toISOString(),
        });
        await tx.insert(schema.authUsers).values({
          id: managerId,
          name: "Rehearsal Manager",
          email: "manager@metsanilo.test",
          emailVerified: false,
          image: null,
          createdAt: now,
          updatedAt: now,
        });
        await tx.insert(schema.authAccounts).values({
          id: `credential-${managerId}`,
          accountId: managerId,
          providerId: "credential",
          userId: managerId,
          password: managerHash,
          createdAt: now,
          updatedAt: now,
        });
      });
    }

    // 5. Run full readiness audit
    const auditResult = await auditAuthReadiness(database, shopId, {
      strictSingleShop: true,
    });

    return {
      ok: auditResult.ok,
      databasePath: dbPath,
      auditResult,
      cleanup,
    };
  } catch (error) {
    cleanup();
    throw error;
  }
}

async function main() {
  console.log("=== Starting Disposable Database Auth Cutover Rehearsal ===");
  let result: RehearsalResult | undefined;
  try {
    result = await runAuthCutoverRehearsal({
      shopId: process.env.SHOP_ID || "shop-main",
    });

    console.log(`Disposable Database: ${result.databasePath}`);
    console.log(`Active Users: ${result.auditResult.activeUsersCount}`);
    console.log(`Admins: ${result.auditResult.adminCount}`);
    console.log(`Managers: ${result.auditResult.managerCount}`);

    if (result.ok) {
      console.log("✅ Rehearsal PASSED: Migration chain applied and invariant audit verified successfully.");
      process.exitCode = 0;
    } else {
      console.error(`❌ Rehearsal FAILED with ${result.auditResult.findings.length} issue(s):`);
      for (const finding of result.auditResult.findings) {
        console.error(`  [${finding.code}] ${finding.message}`);
      }
      process.exitCode = 1;
    }
  } catch (error) {
    console.error("❌ Rehearsal crashed:", error);
    process.exitCode = 2;
  } finally {
    result?.cleanup();
  }
}

if (process.argv[1]?.endsWith("rehearse-auth-cutover.ts") || process.argv[1]?.endsWith("rehearse-auth-cutover.js")) {
  main();
}
