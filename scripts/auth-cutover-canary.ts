import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import type { Database } from "@/db/client";
import * as schema from "@/db/schema";
import { authSessions, users } from "@/db/schema";
import { runAuthCutover, type CutoverResult } from "./cutover-auth";
import { rotateCanaryCredential } from "./rotate-canary-credential";
import { revokeAllUserSessions, validateBetterAuthSession } from "@/lib/auth-integration";

export type CanaryRunOptions = {
  shopId: string;
  canaryUserId: string;
  releaseSha: string;
  target?: "production" | "local";
  allowRepeatCutover?: boolean;
  ownerApprovalReference?: string;
  testHooks?: {
    failCanarySessionCleanup?: boolean;
    failCanaryCredentialRevocation?: boolean;
    simulateCutoverFailure?: boolean;
  };
};

export type CanaryRunResult = {
  ok: boolean;
  cutoverResult?: CutoverResult;
  canaryUserId: string;
  canaryRotatedAuditId?: string;
  preCutoverSessionInvalidated: boolean;
  postCutoverReLoginSucceeded: boolean;
};

export type CanaryCustomError = Error & {
  exitCode?: number;
};

export async function runAuthCutoverCanary(
  database: Database,
  options: CanaryRunOptions
): Promise<CanaryRunResult> {
  const shopId = options.shopId.trim();
  const canaryUserId = options.canaryUserId.trim();
  const releaseSha = options.releaseSha.trim();
  const correlationId = randomUUID();
  const runId = randomUUID();

  // 1. Canary Pre-Checks
  const canaryUser = await database.query.users.findFirst({
    where: and(
      eq(users.id, canaryUserId),
      eq(users.shopId, shopId),
      eq(users.active, true),
      eq(users.role, "MANAGER")
    ),
  });

  if (!canaryUser) {
    const err = new Error(
      `INVALID_CANARY_ACCOUNT: Canary user '${canaryUserId}' not found, inactive, or not MANAGER in shop '${shopId}'.`
    ) as CanaryCustomError;
    err.exitCode = 2;
    throw err;
  }

  // 2. Initial Canary Credential Rotation (generate fresh in-memory credentials)
  await rotateCanaryCredential(database, {
    shopId,
    canaryUserId,
    correlationId,
  });

  // 3. Create Pre-Cutover Session in-memory
  const preCutoverSessionId = `canary-sess-${randomUUID()}`;
  const preCutoverToken = `canary-tok-${randomUUID()}`;
  const now = new Date();
  await database.insert(authSessions).values({
    id: preCutoverSessionId,
    userId: canaryUserId,
    token: preCutoverToken,
    expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
    createdAt: now,
    updatedAt: now,
    lastActivityAt: now,
  });

  // Verify pre-cutover session is active
  const preSessionValidation = await validateBetterAuthSession(
    database,
    preCutoverSessionId,
    canaryUserId,
    now
  );
  if (!preSessionValidation.valid) {
    const err = new Error("Failed to initialize pre-cutover canary session") as CanaryCustomError;
    err.exitCode = 2;
    throw err;
  }

  let cutoverResult: CutoverResult | undefined;
  let preCutoverSessionInvalidated = false;
  let postCutoverReLoginSucceeded = false;
  let finalRotationAuditId: string | undefined;

  let cleanupSessionError: Error | undefined;
  let revocationError: Error | undefined;
  let primaryExecutionError: Error | undefined;

  try {
    if (options.testHooks?.simulateCutoverFailure) {
      throw new Error("Simulated cutover failure in canary runner");
    }

    // 4. Run Cutover
    cutoverResult = await runAuthCutover(database, {
      shopId,
      releaseSha,
      runId,
      correlationId,
      target: options.target,
      allowRepeatCutover: options.allowRepeatCutover,
      ownerApprovalReference: options.ownerApprovalReference,
    });

    // 5. Assert Pre-Cutover Session is Invalidated (Forced Re-Login Verification)
    const postCutoverValidation = await validateBetterAuthSession(
      database,
      preCutoverSessionId,
      canaryUserId,
      new Date()
    );
    preCutoverSessionInvalidated = !postCutoverValidation.valid;

    if (!preCutoverSessionInvalidated) {
      throw new Error("COMMITTED_VERIFICATION_FAILED: Pre-cutover canary session remained valid after cutover!");
    }

    // 6. Assert Canary Re-Login capability
    const postLoginSessionId = `canary-post-${randomUUID()}`;
    const postLoginToken = `canary-post-tok-${randomUUID()}`;
    const postLoginNow = new Date();
    await database.insert(authSessions).values({
      id: postLoginSessionId,
      userId: canaryUserId,
      token: postLoginToken,
      expiresAt: new Date(postLoginNow.getTime() + 60 * 60 * 1000),
      createdAt: postLoginNow,
      updatedAt: postLoginNow,
      lastActivityAt: postLoginNow,
    });

    const postLoginValidation = await validateBetterAuthSession(
      database,
      postLoginSessionId,
      canaryUserId,
      postLoginNow
    );
    postCutoverReLoginSucceeded = postLoginValidation.valid;

    if (!postCutoverReLoginSucceeded) {
      throw new Error("COMMITTED_VERIFICATION_FAILED: Post-cutover canary re-login validation failed!");
    }
  } catch (err: unknown) {
    primaryExecutionError = err instanceof Error ? err : new Error(String(err));
  } finally {
    // 7. Cleanup & Revocation in finally
    try {
      if (options.testHooks?.failCanarySessionCleanup) {
        throw new Error("Simulated canary session cleanup failure");
      }
      await revokeAllUserSessions(database, canaryUserId);
    } catch (cleanErr: unknown) {
      cleanupSessionError = cleanErr instanceof Error ? cleanErr : new Error(String(cleanErr));
    }

    try {
      if (options.testHooks?.failCanaryCredentialRevocation) {
        throw new Error("Simulated canary credential revocation failure");
      }
      const finalRotation = await rotateCanaryCredential(database, {
        shopId,
        canaryUserId,
        correlationId,
      });
      finalRotationAuditId = finalRotation.auditId;
    } catch (rotErr: unknown) {
      revocationError = rotErr instanceof Error ? rotErr : new Error(String(rotErr));
    }
  }

  // Determine exit code & errors according to precedence:
  if (revocationError) {
    const error = new Error(`CANARY_CREDENTIAL_REVOCATION_FAILED: ${revocationError.message}`) as CanaryCustomError;
    error.exitCode = 8;
    throw error;
  }

  if (cleanupSessionError) {
    const error = new Error(`CANARY_CLEANUP_FAILED: ${cleanupSessionError.message}`) as CanaryCustomError;
    error.exitCode = 7;
    throw error;
  }

  if (primaryExecutionError) {
    throw primaryExecutionError;
  }

  return {
    ok: true,
    cutoverResult,
    canaryUserId,
    canaryRotatedAuditId: finalRotationAuditId,
    preCutoverSessionInvalidated,
    postCutoverReLoginSucceeded,
  };
}

async function main() {
  const args = process.argv.slice(2);
  let shopId = process.env.SHOP_ID || "shop-main";
  let canaryUserId: string | undefined;
  let releaseSha = process.env.RELEASE_SHA || "";
  let target: "production" | "local" = "local";
  let allowRepeatCutover = false;
  let ownerApprovalReference: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--shop-id" && i + 1 < args.length) {
      shopId = args[++i];
    } else if (arg.startsWith("--shop-id=")) {
      shopId = arg.slice("--shop-id=".length);
    } else if (arg === "--canary-user-id" && i + 1 < args.length) {
      canaryUserId = args[++i];
    } else if (arg.startsWith("--canary-user-id=")) {
      canaryUserId = arg.slice("--canary-user-id=".length);
    } else if (arg === "--release-sha" && i + 1 < args.length) {
      releaseSha = args[++i];
    } else if (arg.startsWith("--release-sha=")) {
      releaseSha = arg.slice("--release-sha=".length);
    } else if (arg === "--target" && i + 1 < args.length) {
      const next = args[++i];
      target = next === "production" ? "production" : "local";
    } else if (arg.startsWith("--target=")) {
      const targetVal = arg.slice("--target=".length);
      target = targetVal === "production" ? "production" : "local";
    } else if (arg === "--allow-repeat-cutover") {
      allowRepeatCutover = true;
    } else if (arg === "--owner-approval-ref" && i + 1 < args.length) {
      ownerApprovalReference = args[++i];
    } else if (arg.startsWith("--owner-approval-ref=")) {
      ownerApprovalReference = arg.slice("--owner-approval-ref=".length);
    }
  }

  if (!canaryUserId) {
    console.error("Error: --canary-user-id <userId> is required.");
    process.exitCode = 2;
    return;
  }
  if (!releaseSha) {
    console.error("Error: --release-sha <sha> is required.");
    process.exitCode = 2;
    return;
  }

  const databaseUrl = process.env.TURSO_DATABASE_URL || "file:local.db";
  const authToken = process.env.TURSO_AUTH_TOKEN;

  const client = createClient({
    url: databaseUrl,
    authToken,
  });

  try {
    const database = drizzle(client, { schema });
    const result = await runAuthCutoverCanary(database, {
      shopId,
      canaryUserId,
      releaseSha,
      target,
      allowRepeatCutover,
      ownerApprovalReference,
    });

    console.log(`Canary cutover verification SUCCEEDED for shop '${shopId}' (Canary: ${result.canaryUserId}).`);
    console.log(`Pre-cutover session invalidated: ${result.preCutoverSessionInvalidated}`);
    console.log(`Post-cutover re-login succeeded: ${result.postCutoverReLoginSucceeded}`);
    process.exitCode = 0;
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    console.error("Canary cutover runner failed:", errMessage);
    const customErr = error as CanaryCustomError;
    process.exitCode = customErr?.exitCode ?? 1;
  } finally {
    client.close();
  }
}

if (process.argv[1]?.endsWith("auth-cutover-canary.ts") || process.argv[1]?.endsWith("auth-cutover-canary.js")) {
  main();
}
