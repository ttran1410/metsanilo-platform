import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { and, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import * as schema from "@/db/schema";
import { users } from "@/db/schema";
import { validateRuntimeEnvironment } from "@/lib/env";

export type AuditReadinessResult = {
  ok: boolean;
  activeUsersCount: number;
  adminCount: number;
  managerCount: number;
  errors: string[];
};

export async function auditAuthReadiness(
  database: Database,
  shopId: string,
): Promise<AuditReadinessResult> {
  const errors: string[] = [];

  const activeUsers = await database.query.users.findMany({
    where: and(eq(users.shopId, shopId), eq(users.active, true)),
  });

  const allAuthUsers = await database.query.authUsers.findMany();
  const allAuthAccounts = await database.query.authAccounts.findMany();

  const authUserMap = new Map(allAuthUsers.map((u) => [u.id, u]));
  const authAccountMap = new Map<string, typeof allAuthAccounts>();

  for (const account of allAuthAccounts) {
    const list = authAccountMap.get(account.userId) ?? [];
    list.push(account);
    authAccountMap.set(account.userId, list);
  }

  let adminCount = 0;
  let managerCount = 0;

  for (const user of activeUsers) {
    if (!user.passwordHash || user.passwordHash.trim().length === 0) {
      errors.push(`Active user ${user.id} (${user.email}) is missing passwordHash credential mirror.`);
    }

    const authUser = authUserMap.get(user.id);
    if (!authUser) {
      errors.push(`Active user ${user.id} (${user.email}) is missing auth_users record.`);
    } else if (user.email && authUser.email.toLowerCase() !== user.email.toLowerCase()) {
      errors.push(
        `Active user ${user.id} email mismatch between users (${user.email}) and auth_users (${authUser.email}).`,
      );
    }

    const userAccounts = authAccountMap.get(user.id) ?? [];
    const credentialAccounts = userAccounts.filter((a) => a.providerId === "credential");

    if (credentialAccounts.length === 0) {
      errors.push(`Active user ${user.id} (${user.email}) has no Better Auth credential account.`);
    } else if (credentialAccounts.length > 1) {
      errors.push(`Active user ${user.id} (${user.email}) has ${credentialAccounts.length} credential accounts (expected exactly 1).`);
    } else {
      const cred = credentialAccounts[0];
      if (!cred.password || cred.password.trim().length === 0) {
        errors.push(`Active user ${user.id} (${user.email}) has empty password in credential account.`);
      }
    }

    if (user.role === "ADMIN") adminCount++;
    if (user.role === "MANAGER") managerCount++;
  }

  if (adminCount === 0) {
    errors.push("Role coverage check failed: no active ADMIN user found.");
  }
  if (managerCount === 0) {
    errors.push("Role coverage check failed: no active MANAGER user found.");
  }

  const allUsers = await database.query.users.findMany({
    where: eq(users.shopId, shopId),
  });
  const allUserIds = new Set(allUsers.map((u) => u.id));

  for (const authUser of allAuthUsers) {
    if (!allUserIds.has(authUser.id)) {
      errors.push(`Orphan auth_user found: ${authUser.id} (${authUser.email}) has no matching shop user.`);
    }
  }

  for (const account of allAuthAccounts) {
    if (!authUserMap.has(account.userId)) {
      errors.push(`Orphan auth_account found: account ${account.id} references non-existent auth_user ${account.userId}.`);
    }
  }

  return {
    ok: errors.length === 0,
    activeUsersCount: activeUsers.length,
    adminCount,
    managerCount,
    errors,
  };
}

async function main() {
  const envResult = validateRuntimeEnvironment({
    production: process.env.NODE_ENV === "production" || process.env.RELEASE_PREFLIGHT === "true",
  });

  if (!envResult.ok) {
    console.error("Environment validation failed:");
    for (const error of envResult.errors) console.error(`- ${error}`);
    process.exit(2);
  }

  const shopId = envResult.config.SHOP_ID || "shop-main";
  let client;

  try {
    client = createClient({
      url: envResult.config.TURSO_DATABASE_URL,
      authToken: envResult.config.TURSO_AUTH_TOKEN,
    });
  } catch (error) {
    console.error("Failed to initialize database client:", error);
    process.exit(2);
  }

  try {
    const database = drizzle(client, { schema });
    const audit = await auditAuthReadiness(database, shopId);

    console.log(`--- Better Auth Readiness Audit (Shop: ${shopId}) ---`);
    console.log(`Active users: ${audit.activeUsersCount}`);
    console.log(`Active admins: ${audit.adminCount}`);
    console.log(`Active managers: ${audit.managerCount}`);

    if (audit.ok) {
      console.log("Status: PASSED - All users and accounts are ready for legacy decommission.");
      process.exit(0);
    } else {
      console.error(`Status: FAILED - Found ${audit.errors.length} issue(s):`);
      for (const err of audit.errors) console.error(`  [!] ${err}`);
      process.exit(1);
    }
  } catch (error) {
    console.error("Unexpected error during readiness audit:", error);
    process.exit(2);
  } finally {
    client.close();
  }
}

if (process.argv[1]?.endsWith("audit-auth-readiness.ts") || process.argv[1]?.endsWith("audit-auth-readiness.js")) {
  main();
}
