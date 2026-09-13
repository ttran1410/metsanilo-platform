import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { and, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import * as schema from "@/db/schema";
import { users } from "@/db/schema";
import { isSupportedPasswordHash } from "@/domain/passwords";
import { isCredentialStateValid, isTemporaryCredentialActive } from "@/lib/auth-integration";
import { validateSessionTimestampState } from "@/lib/session-timing";
import { PRODUCTION_ORIGIN } from "@/lib/auth-config";

export type AuthReadinessFinding = {
  code:
    | "MISSING_PASSWORD_HASH"
    | "INVALID_PASSWORD_HASH_FORMAT"
    | "MISSING_AUTH_USER"
    | "EMAIL_MISMATCH"
    | "NO_CREDENTIAL_ACCOUNT"
    | "MULTIPLE_CREDENTIAL_ACCOUNTS"
    | "CREDENTIAL_ACCOUNT_ID_MISMATCH"
    | "EMPTY_CREDENTIAL_PASSWORD"
    | "INVALID_CREDENTIAL_PASSWORD_FORMAT"
    | "CREDENTIAL_MIRROR_MISMATCH"
    | "INVALID_CREDENTIAL_STATE"
    | "ORPHAN_AUTH_USER"
    | "ORPHAN_AUTH_ACCOUNT"
    | "ORPHAN_SESSION"
    | "INACTIVE_USER_SESSION"
    | "SESSION_TIMESTAMP_INVALID"
    | "CROSS_SHOP_AUTH_GRAPH"
    | "NO_ACTIVE_ADMIN"
    | "NO_ACTIVE_MANAGER";
  message: string;
  details?: Record<string, unknown>;
};

export type AuditReadinessResult = {
  ok: boolean;
  activeUsersCount: number;
  adminCount: number;
  managerCount: number;
  expiredTemporaryPasswordCount: number;
  errors: string[];
  findings: AuthReadinessFinding[];
};

export type CutoverReadinessResult = {
  ok: boolean;
  activeUsersCount: number;
  adminCount: number;
  managerCount: number;
  expiredTemporaryPasswordCount: number;
  errors: string[];
  findings: AuthReadinessFinding[];
};

export type AuditReadinessOptions = {
  strictSingleShop?: boolean;
  now?: Date;
};

export type DatabaseReader = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

export async function auditAuthCutoverReadiness(
  database: DatabaseReader,
  shopId: string,
  options: AuditReadinessOptions = {}
): Promise<CutoverReadinessResult> {
  const readiness = await auditAuthReadiness(database, shopId, {
    strictSingleShop: options.strictSingleShop ?? true,
    now: options.now,
  });

  return {
    ok: readiness.ok,
    activeUsersCount: readiness.activeUsersCount,
    adminCount: readiness.adminCount,
    managerCount: readiness.managerCount,
    expiredTemporaryPasswordCount: readiness.expiredTemporaryPasswordCount,
    findings: readiness.findings,
    errors: readiness.errors,
  };
}

export async function auditAuthReadiness(
  database: DatabaseReader,
  shopId: string,
  options: AuditReadinessOptions = {}
): Promise<AuditReadinessResult> {
  const findings: AuthReadinessFinding[] = [];
  const now = options.now ?? new Date();

  const activeShopUsers = await database.query.users.findMany({
    where: and(eq(users.shopId, shopId), eq(users.active, true)),
  });

  const allGlobalUsers = await database.query.users.findMany();
  const allAuthUsers = await database.query.authUsers.findMany();
  const allAuthAccounts = await database.query.authAccounts.findMany();
  const allAuthSessions = await database.query.authSessions.findMany();

  const globalUserMap = new Map(allGlobalUsers.map((u) => [u.id, u]));
  const authUserMap = new Map(allAuthUsers.map((u) => [u.id, u]));

  const authAccountMap = new Map<string, typeof allAuthAccounts>();
  for (const account of allAuthAccounts) {
    const list = authAccountMap.get(account.userId) ?? [];
    list.push(account);
    authAccountMap.set(account.userId, list);
  }

  const authSessionMap = new Map<string, typeof allAuthSessions>();
  for (const session of allAuthSessions) {
    const list = authSessionMap.get(session.userId) ?? [];
    list.push(session);
    authSessionMap.set(session.userId, list);
  }

  let adminCount = 0;
  let managerCount = 0;
  let expiredTemporaryPasswordCount = 0;

  for (const user of activeShopUsers) {
    if (!isCredentialStateValid(user)) {
      findings.push({
        code: "INVALID_CREDENTIAL_STATE",
        message: `Active user ${user.id} (${user.email}) has invalid temporary credential state.`,
        details: { userId: user.id, email: user.email },
      });
    } else if (user.mustChangePassword && !isTemporaryCredentialActive(user, now)) {
      expiredTemporaryPasswordCount++;
    }

    const authUser = authUserMap.get(user.id);
    if (!authUser) {
      findings.push({
        code: "MISSING_AUTH_USER",
        message: `Active user ${user.id} (${user.email}) is missing auth_users record.`,
        details: { userId: user.id, email: user.email },
      });
    } else if (user.email && authUser.email.toLowerCase() !== user.email.toLowerCase()) {
      findings.push({
        code: "EMAIL_MISMATCH",
        message: `Active user ${user.id} email mismatch between users (${user.email}) and auth_users (${authUser.email}).`,
        details: { userId: user.id, userEmail: user.email, authUserEmail: authUser.email },
      });
    }

    const userAccounts = authAccountMap.get(user.id) ?? [];
    const credentialAccounts = userAccounts.filter((a) => a.providerId === "credential");

    if (credentialAccounts.length === 0) {
      findings.push({
        code: "NO_CREDENTIAL_ACCOUNT",
        message: `Active user ${user.id} (${user.email}) has no Better Auth credential account.`,
        details: { userId: user.id, email: user.email },
      });
    } else if (credentialAccounts.length > 1) {
      findings.push({
        code: "MULTIPLE_CREDENTIAL_ACCOUNTS",
        message: `Active user ${user.id} (${user.email}) has ${credentialAccounts.length} credential accounts (expected exactly 1).`,
        details: { userId: user.id, email: user.email, count: credentialAccounts.length },
      });
    } else {
      const cred = credentialAccounts[0];
      if (cred.accountId !== user.id) {
        findings.push({
          code: "CREDENTIAL_ACCOUNT_ID_MISMATCH",
          message: `Active user ${user.id} (${user.email}) has mismatched auth_accounts.account_id (${cred.accountId} !== ${user.id}).`,
          details: { userId: user.id, accountId: cred.accountId },
        });
      }
      if (!cred.password || cred.password.trim().length === 0) {
        findings.push({
          code: "EMPTY_CREDENTIAL_PASSWORD",
          message: `Active user ${user.id} (${user.email}) has empty password in credential account.`,
          details: { userId: user.id, email: user.email },
        });
      } else if (!isSupportedPasswordHash(cred.password)) {
        findings.push({
          code: "INVALID_CREDENTIAL_PASSWORD_FORMAT",
          message: `Active user ${user.id} (${user.email}) has unsupported credential account password format.`,
          details: { userId: user.id, email: user.email },
        });
      }
    }

    if (user.role === "ADMIN") adminCount++;
    if (user.role === "MANAGER") managerCount++;
  }

  if (adminCount === 0) {
    findings.push({
      code: "NO_ACTIVE_ADMIN",
      message: "Role coverage check failed: no active ADMIN user found.",
    });
  }
  if (managerCount === 0) {
    findings.push({
      code: "NO_ACTIVE_MANAGER",
      message: "Role coverage check failed: no active MANAGER user found.",
    });
  }

  // Global identity graph checks (Always check global completeness)
  for (const authUser of allAuthUsers) {
    const matchingUser = globalUserMap.get(authUser.id);
    if (!matchingUser) {
      findings.push({
        code: "ORPHAN_AUTH_USER",
        message: `Orphan auth_user found: ${authUser.id} (${authUser.email}) has no matching global user.`,
        details: { authUserId: authUser.id, email: authUser.email },
      });
    }
  }

  for (const account of allAuthAccounts) {
    if (!authUserMap.has(account.userId) || !globalUserMap.has(account.userId)) {
      findings.push({
        code: "ORPHAN_AUTH_ACCOUNT",
        message: `Orphan auth_account found: account ${account.id} references non-existent user ${account.userId}.`,
        details: { accountId: account.id, userId: account.userId },
      });
    }
  }

  for (const session of allAuthSessions) {
    const userInGlobal = globalUserMap.get(session.userId);
    if (!authUserMap.has(session.userId) || !userInGlobal) {
      findings.push({
        code: "ORPHAN_SESSION",
        message: `Orphan auth_session found: session ${session.id} references non-existent user ${session.userId}.`,
        details: { sessionId: session.id, userId: session.userId },
      });
    } else if (!userInGlobal.active) {
      findings.push({
        code: "INACTIVE_USER_SESSION",
        message: `Active session ${session.id} belongs to inactive user ${userInGlobal.id}.`,
        details: { sessionId: session.id, userId: userInGlobal.id },
      });
    }

    const tsValidation = validateSessionTimestampState({
      createdAt: session.createdAt,
      providerExpiresAt: session.expiresAt,
      lastActivityAt: session.lastActivityAt,
    });
    if (!tsValidation.valid) {
      findings.push({
        code: "SESSION_TIMESTAMP_INVALID",
        message: `Session ${session.id} has invalid timestamps: ${tsValidation.errors.join(", ")}`,
        details: { sessionId: session.id, errors: tsValidation.errors },
      });
    }
  }

  if (options.strictSingleShop) {
    // Verify no auth resources belong to other shops (strict single shop boundary)
    for (const u of allGlobalUsers) {
      if (u.shopId !== shopId) {
        if (authUserMap.has(u.id) || authAccountMap.has(u.id) || authSessionMap.has(u.id)) {
          findings.push({
            code: "CROSS_SHOP_AUTH_GRAPH",
            message: `Cross-shop auth record detected for user ${u.id} in non-target shop ${u.shopId}.`,
            details: { userId: u.id, shopId: u.shopId },
          });
        }
      }
    }
  }

  const errors = findings.map((f) => f.message);

  return {
    ok: findings.length === 0,
    activeUsersCount: activeShopUsers.length,
    adminCount,
    managerCount,
    expiredTemporaryPasswordCount,
    errors,
    findings,
  };
}

function parseTargetUrl(rawUrl: string): { protocol: string; isFile: boolean; isRemote: boolean } {
  const trimmed = rawUrl.trim();
  if (trimmed.startsWith("file:")) {
    return { protocol: "file:", isFile: true, isRemote: false };
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`Malformed database URL: '${rawUrl}'. Must be a valid file: URL or remote libsql:/https: URL.`);
  }

  const protocol = parsed.protocol;
  const isRemote = protocol === "libsql:" || protocol === "https:";
  if (!isRemote && protocol !== "file:") {
    throw new Error(`Unsupported database URL protocol '${protocol}'. Only 'file:', 'libsql:', and 'https:' are supported.`);
  }
  return { protocol, isFile: protocol === "file:", isRemote };
}

export function resolveAuditTarget(
  argv: string[] = process.argv.slice(2),
  envVars: Record<string, string | undefined> = process.env
): { target: "local" | "production" | "explicit"; databaseUrl: string; authToken?: string; shopId: string } {
  let explicitUrl: string | undefined;
  let targetFlag: string | undefined;
  let shopIdFlag: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--target" && i + 1 < argv.length) {
      targetFlag = argv[++i];
    } else if (arg.startsWith("--target=")) {
      targetFlag = arg.slice("--target=".length);
    } else if (arg === "--url" && i + 1 < argv.length) {
      explicitUrl = argv[++i];
    } else if (arg.startsWith("--url=")) {
      explicitUrl = arg.slice("--url=".length);
    } else if (arg === "--shop-id" && i + 1 < argv.length) {
      shopIdFlag = argv[++i];
    } else if (arg.startsWith("--shop-id=")) {
      shopIdFlag = arg.slice("--shop-id=".length);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (targetFlag && targetFlag !== "production" && targetFlag !== "local") {
    throw new Error(`Invalid target: ${targetFlag}. Allowed targets are 'production' or 'local'.`);
  }

  if (targetFlag === "production" && explicitUrl) {
    throw new Error("Cannot combine --target=production with --url. Use TURSO_DATABASE_URL environment variable for production.");
  }

  // 1. Explicit URL target
  if (explicitUrl) {
    const urlInfo = parseTargetUrl(explicitUrl);
    if (urlInfo.isRemote) {
      throw new Error("Remote database URL cannot be audited via --url without --target=production.");
    }
    const shopId = (shopIdFlag || envVars.SHOP_ID || "shop-main").trim();
    if (shopId.length === 0) {
      throw new Error("SHOP_ID cannot be empty");
    }
    return {
      target: "explicit",
      databaseUrl: explicitUrl.trim(),
      authToken: envVars.TURSO_AUTH_TOKEN?.trim() || undefined,
      shopId,
    };
  }

  // 2. Production target
  if (targetFlag === "production") {
    const prodUrl = envVars.TURSO_DATABASE_URL?.trim();
    if (!prodUrl) {
      throw new Error("Target is set to production but TURSO_DATABASE_URL is missing");
    }
    const urlInfo = parseTargetUrl(prodUrl);
    if (!urlInfo.isRemote) {
      throw new Error("Target is set to production but TURSO_DATABASE_URL is missing or local file URL");
    }
    const authToken = envVars.TURSO_AUTH_TOKEN?.trim();
    if (!authToken || authToken.length === 0) {
      throw new Error("Target is set to production but TURSO_AUTH_TOKEN is missing or empty");
    }
    const shopId = (shopIdFlag || envVars.SHOP_ID)?.trim();
    if (!shopId || shopId.length === 0) {
      throw new Error("Target is set to production but SHOP_ID is not explicitly configured");
    }
    return {
      target: "production",
      databaseUrl: prodUrl,
      authToken,
      shopId,
    };
  }

  // 3. Local target (Default)
  const envUrl = envVars.TURSO_DATABASE_URL?.trim();
  if (envUrl) {
    const urlInfo = parseTargetUrl(envUrl);
    if (urlInfo.isRemote) {
      throw new Error("TURSO_DATABASE_URL points to a remote database, but target is not 'production'. Refusing to audit remote database without --target=production.");
    }
  }

  const localUrl = envUrl || "file:local.db";
  const shopId = (shopIdFlag || envVars.SHOP_ID || "shop-main").trim();
  if (shopId.length === 0) {
    throw new Error("SHOP_ID cannot be empty");
  }
  return {
    target: "local",
    databaseUrl: localUrl,
    authToken: envVars.TURSO_AUTH_TOKEN?.trim() || undefined,
    shopId,
  };
}

export function validateAuditTargetConfig(targetInfo: {
  target: "local" | "production" | "explicit";
  databaseUrl: string;
  authToken?: string;
  shopId: string;
}): { ok: boolean; errors: string[] } {
  const errors: string[] = [];

  if (targetInfo.target === "production") {
    const urlInfo = parseTargetUrl(targetInfo.databaseUrl);
    if (!urlInfo.isRemote) {
      errors.push("TURSO_DATABASE_URL must be a remote Turso URL (libsql: or https:) in production");
    }
    if (!targetInfo.authToken || targetInfo.authToken.trim().length === 0) {
      errors.push("TURSO_AUTH_TOKEN is required in production");
    }
    if (!targetInfo.shopId || targetInfo.shopId.trim().length === 0) {
      errors.push("SHOP_ID is required in production");
    }
    const betterAuthSecret = process.env.BETTER_AUTH_SECRET?.trim();
    if (!betterAuthSecret || betterAuthSecret.length < 32) {
      errors.push("BETTER_AUTH_SECRET must be at least 32 characters");
    }
    let betterAuthOrigin = "";
    try {
      betterAuthOrigin = new URL(process.env.BETTER_AUTH_URL ?? "").origin;
    } catch {
      // handled below
    }
    if (betterAuthOrigin !== PRODUCTION_ORIGIN) {
      errors.push(`BETTER_AUTH_URL must use ${PRODUCTION_ORIGIN} in production`);
    }
  } else {
    if (!targetInfo.shopId || targetInfo.shopId.trim().length === 0) {
      errors.push("SHOP_ID cannot be empty");
    }
  }

  return { ok: errors.length === 0, errors };
}

async function main() {
  let targetInfo;
  try {
    targetInfo = resolveAuditTarget(process.argv.slice(2), process.env);
  } catch (err) {
    console.error("Target resolution error:", err instanceof Error ? err.message : err);
    process.exitCode = 2;
    return;
  }

  const configValidation = validateAuditTargetConfig(targetInfo);
  if (!configValidation.ok && targetInfo.target === "production") {
    console.error("Configuration validation failed for production audit:");
    for (const error of configValidation.errors) console.error(`- ${error}`);
    process.exitCode = 2;
    return;
  }

  let client;
  try {
    client = createClient({
      url: targetInfo.databaseUrl,
      authToken: targetInfo.authToken,
    });
  } catch (error) {
    console.error("Failed to initialize database client:", error);
    process.exitCode = 2;
    return;
  }

  try {
    const database = drizzle(client, { schema });
    const audit = await auditAuthReadiness(database, targetInfo.shopId, {
      strictSingleShop: targetInfo.target === "production",
    });

    console.log(`--- Better Auth Readiness Audit (Shop: ${targetInfo.shopId}, Target: ${targetInfo.target}) ---`);
    console.log(`Active users: ${audit.activeUsersCount}`);
    console.log(`Active admins: ${audit.adminCount}`);
    console.log(`Active managers: ${audit.managerCount}`);
    if (audit.expiredTemporaryPasswordCount > 0) {
      console.log(`Info: ${audit.expiredTemporaryPasswordCount} active user(s) have expired temporary password.`);
    }

    if (audit.ok) {
      console.log("Status: PASSED - All users and accounts are ready for legacy decommission.");
      process.exitCode = 0;
    } else {
      console.error(`Status: FAILED - Found ${audit.findings.length} issue(s):`);
      for (const finding of audit.findings) {
        console.error(`  [${finding.code}] ${finding.message}`);
      }
      process.exitCode = 1;
    }
  } catch (error) {
    console.error("Unexpected error during readiness audit:", error);
    process.exitCode = 2;
  } finally {
    client.close();
  }
}

if (process.argv[1]?.endsWith("audit-auth-readiness.ts") || process.argv[1]?.endsWith("audit-auth-readiness.js")) {
  main();
}
