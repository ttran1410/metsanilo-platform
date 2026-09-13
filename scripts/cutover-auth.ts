import { randomUUID } from "node:crypto";
import { and, eq, sql, inArray } from "drizzle-orm";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import type { Database } from "@/db/client";
import * as schema from "@/db/schema";
import { auditEntries, authSessions, users } from "@/db/schema";
import { isCanonicalIsoDate } from "@/lib/auth-integration";
import { auditAuthCutoverReadiness } from "./audit-auth-readiness";

export type CutoverAuditPayload = {
  runId: string;
  releaseSha: string;
  target: "production" | "local";
  shopId: string;
  totalSessionsDeletedCount: number;
  updatedUsersCount: number;
  correlationId: string;
  committedAt: string;
  ownerApprovalReference?: string;
};

export type CutoverOptions = {
  shopId: string;
  releaseSha: string;
  runId?: string;
  correlationId?: string;
  target?: "production" | "local";
  allowRepeatCutover?: boolean;
  ownerApprovalReference?: string;
  now?: Date;
  testHooks?: {
    beforeTransactionCommit?: () => void | Promise<void>;
    afterTransactionCommit?: () => void | Promise<void>;
    failPostCommitLockCleanup?: boolean;
    failRollbackLockCleanup?: boolean;
  };
};

export type CutoverResult = {
  status: "COMMITTED" | "ALREADY_EXECUTED";
  shopId: string;
  runId: string;
  releaseSha: string;
  target: "production" | "local";
  totalSessionsDeletedCount: number;
  updatedUsersCount: number;
  committedAt: string;
  correlationId: string;
};

const LOCK_TTL_MS = 15 * 60 * 1000; // 15 minutes
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA_REGEX = /^[0-9a-f]{7,64}$/i;

export type CutoverCustomError = Error & {
  exitCode?: number;
  originalError?: unknown;
};

export function isValidShopCutoverMarker(
  markerRow: {
    id: string;
    shopId: string;
    action: string;
    entityType?: string;
    entityId?: string;
    detailsJson: string;
  } | null | undefined,
  shopId: string
): boolean {
  if (
    !markerRow ||
    markerRow.id !== `audit:cutover:${shopId}` ||
    markerRow.shopId !== shopId ||
    markerRow.action !== "auth.cutover_executed"
  ) {
    return false;
  }
  if (markerRow.entityType && markerRow.entityType !== "system") {
    return false;
  }
  if (markerRow.entityId && markerRow.entityId !== "auth-cutover") {
    return false;
  }

  try {
    const payload = JSON.parse(markerRow.detailsJson) as CutoverAuditPayload;
    if (
      payload.shopId !== shopId ||
      !UUID_REGEX.test(payload.runId) ||
      !SHA_REGEX.test(payload.releaseSha) ||
      (payload.target !== "production" && payload.target !== "local") ||
      !isCanonicalIsoDate(payload.committedAt) ||
      typeof payload.totalSessionsDeletedCount !== "number" ||
      payload.totalSessionsDeletedCount < 0 ||
      !Number.isInteger(payload.totalSessionsDeletedCount) ||
      typeof payload.updatedUsersCount !== "number" ||
      payload.updatedUsersCount < 0 ||
      !Number.isInteger(payload.updatedUsersCount) ||
      typeof payload.correlationId !== "string" ||
      payload.correlationId.length === 0
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function runAuthCutover(
  database: Database,
  options: CutoverOptions
): Promise<CutoverResult> {
  const shopId = options.shopId.trim();
  if (!shopId) {
    throw new Error("VALIDATION_FAILED: shopId cannot be empty");
  }

  const releaseSha = options.releaseSha.trim();
  if (!releaseSha || !SHA_REGEX.test(releaseSha)) {
    throw new Error("VALIDATION_FAILED: releaseSha must be a valid commit SHA");
  }

  const runId = options.runId ?? randomUUID();
  const correlationId = options.correlationId ?? randomUUID();
  const target = options.target ?? "local";
  const now = options.now ?? new Date();
  const lockId = `lock:auth-cutover:${shopId}`;
  const lockToken = randomUUID();

  // 1. Check existing locks and previous cutovers
  const existingLock = await database.query.auditEntries.findFirst({
    where: and(eq(auditEntries.id, lockId), eq(auditEntries.shopId, shopId)),
  });

  const existingMarker = await database.query.auditEntries.findFirst({
    where: and(eq(auditEntries.id, `audit:cutover:${shopId}`), eq(auditEntries.shopId, shopId)),
  });

  if (existingMarker) {
    if (!isValidShopCutoverMarker(existingMarker, shopId)) {
      throw new Error("CUTOVER_MARKER_INVALID: Existing cutover marker is malformed or corrupted.");
    }

    const payload = JSON.parse(existingMarker.detailsJson) as CutoverAuditPayload;

    if (!options.allowRepeatCutover) {
      if (existingLock) {
        // If cutover is already completed but a stale lock remains, clean it up
        await database.delete(auditEntries).where(eq(auditEntries.id, lockId)).run();
      }
      return {
        status: "ALREADY_EXECUTED",
        shopId,
        runId: payload.runId,
        releaseSha: payload.releaseSha,
        target: payload.target,
        totalSessionsDeletedCount: payload.totalSessionsDeletedCount,
        updatedUsersCount: payload.updatedUsersCount,
        committedAt: payload.committedAt,
        correlationId: payload.correlationId,
      };
    }

    if (payload.releaseSha === releaseSha) {
      throw new Error(
        "REPEAT_CUTOVER_REQUIRES_DISTINCT_RELEASE_SHA: Repeat cutover cannot use the same releaseSha as the previously executed cutover."
      );
    }

    if (!options.ownerApprovalReference || options.ownerApprovalReference.trim().length < 5) {
      throw new Error(
        "REPEAT_CUTOVER_REQUIRES_OWNER_APPROVAL: Owner approval reference of at least 5 characters is required for repeat cutover."
      );
    }
  }

  if (existingLock) {
    let lockAgeMs = LOCK_TTL_MS + 1;
    let existingLockToken: string | undefined;
    try {
      const lockDetails = JSON.parse(existingLock.detailsJson);
      existingLockToken = lockDetails.lockToken;
      const lockedTime = new Date(lockDetails.lockedAt || existingLock.createdAt).getTime();
      lockAgeMs = now.getTime() - lockedTime;
    } catch {
      // malformed lock details treated as expired
    }

    if (lockAgeMs < LOCK_TTL_MS) {
      throw new Error(
        `CONCURRENT_EXECUTION_REJECTED: Cutover is currently in progress for shop '${shopId}' (Lock ID: ${lockId}).`
      );
    }

    // Recover stale lock atomically in transaction
    await database.transaction(async (tx) => {
      await tx.insert(auditEntries).values({
        id: `audit:cutover:recovery:${shopId}:${runId}`,
        shopId,
        actor: "system",
        action: "auth.cutover_lock_recovered",
        entityType: "system",
        entityId: "auth-cutover",
        detailsJson: JSON.stringify({
          shopId,
          runId,
          recoveredLockId: lockId,
          recoveredLockToken: existingLockToken,
          recoveredAt: now.toISOString(),
        }),
        createdAt: now.toISOString(),
      });
      await tx.delete(auditEntries).where(and(eq(auditEntries.id, lockId), eq(auditEntries.shopId, shopId))).run();
    });
  }

  // 2. Acquire Mutex Lock
  await database.insert(auditEntries).values({
    id: lockId,
    shopId,
    actor: "system",
    action: "auth.cutover_in_progress",
    entityType: "system",
    entityId: "auth-cutover",
    detailsJson: JSON.stringify({
      shopId,
      runId,
      lockToken,
      releaseSha,
      target,
      lockedAt: now.toISOString(),
      ttlMs: LOCK_TTL_MS,
    }),
    createdAt: now.toISOString(),
  });

  let isMutationCommitted = false;
  let cutoverResult: CutoverResult | undefined;

  try {
    // 3. Cutover Transaction
    await database.transaction(async (tx) => {
      // A. In-transaction readiness validation
      const readiness = await auditAuthCutoverReadiness(tx, shopId, { strictSingleShop: true, now });
      if (!readiness.ok) {
        throw new Error(`VALIDATION_FAILED: ${readiness.errors.join("; ")}`);
      }

      const committedAt = new Date().toISOString();

      // B. Delete Better Auth sessions and retrieve rowsAffected
      const shopUserRows = await tx.query.users.findMany({
        where: eq(users.shopId, shopId),
        columns: { id: true },
      });
      const shopUserIds = shopUserRows.map((u) => u.id);

      let sessionsDeleted = 0;
      if (shopUserIds.length > 0) {
        const deleteResult = await tx
          .delete(authSessions)
          .where(inArray(authSessions.userId, shopUserIds))
          .run();
        sessionsDeleted = deleteResult.rowsAffected ?? 0;
      }

      // C. Increment users.session_version
      const updateResult = await tx
        .update(users)
        .set({
          sessionVersion: sql`${users.sessionVersion} + 1`,
        })
        .where(eq(users.shopId, shopId))
        .run();

      const updatedUsersCount = updateResult.rowsAffected || shopUserIds.length;

      // D. Insert Audit Markers (Pure immutable insert)
      const auditPayload: CutoverAuditPayload = {
        runId,
        releaseSha,
        target,
        shopId,
        totalSessionsDeletedCount: sessionsDeleted,
        updatedUsersCount,
        correlationId,
        committedAt,
        ownerApprovalReference: options.ownerApprovalReference,
      };

      if (!options.allowRepeatCutover) {
        // Primary shop marker (only insert if first time)
        await tx.insert(auditEntries).values({
          id: `audit:cutover:${shopId}`,
          shopId,
          actor: "system",
          action: "auth.cutover_executed",
          entityType: "system",
          entityId: "auth-cutover",
          detailsJson: JSON.stringify(auditPayload),
          createdAt: committedAt,
        });
      } else {
        // Repeat cutover marker with runId
        await tx.insert(auditEntries).values({
          id: `audit:cutover:${shopId}:${runId}`,
          shopId,
          actor: "system",
          action: "auth.cutover_repeat",
          entityType: "system",
          entityId: "auth-cutover",
          detailsJson: JSON.stringify(auditPayload),
          createdAt: committedAt,
        });
      }

      // Release SHA marker
      await tx.insert(auditEntries).values({
        id: `audit:cutover:${shopId}:${releaseSha}`,
        shopId,
        actor: "system",
        action: "auth.cutover_release",
        entityType: "system",
        entityId: "auth-cutover",
        detailsJson: JSON.stringify(auditPayload),
        createdAt: committedAt,
      });

      // E. Release Mutex Lock inside transaction
      await tx.delete(auditEntries).where(and(eq(auditEntries.id, lockId), eq(auditEntries.shopId, shopId))).run();

      if (options.testHooks?.beforeTransactionCommit) {
        await options.testHooks.beforeTransactionCommit();
      }

      cutoverResult = {
        status: "COMMITTED",
        shopId,
        runId,
        releaseSha,
        target,
        totalSessionsDeletedCount: sessionsDeleted,
        updatedUsersCount,
        committedAt,
        correlationId,
      };
    });

    isMutationCommitted = true;

    if (options.testHooks?.afterTransactionCommit) {
      await options.testHooks.afterTransactionCommit();
    }
  } catch (error) {
    if (!isMutationCommitted) {
      // Transaction rolled back, clean up lock token-bound
      try {
        if (options.testHooks?.failRollbackLockCleanup) {
          throw new Error("Simulated rollback lock cleanup failure");
        }
        await database.delete(auditEntries).where(and(eq(auditEntries.id, lockId), eq(auditEntries.shopId, shopId))).run();
      } catch (lockError) {
        const wrappedError = new Error(
          `ROLLBACK_LOCK_CLEANUP_PENDING: Cutover rolled back due to error (${
            error instanceof Error ? error.message : error
          }), but mutex lock cleanup failed (${
            lockError instanceof Error ? lockError.message : lockError
          }). Manual lock removal required for lock '${lockId}'.`
        ) as CutoverCustomError;
        wrappedError.originalError = error;
        wrappedError.exitCode = 5;
        throw wrappedError;
      }
    }
    throw error;
  }

  // 4. Post-Commit Verification & Lock Cleanup Check
  try {
    if (options.testHooks?.failPostCommitLockCleanup) {
      throw new Error("Simulated post-commit lock cleanup failure");
    }

    const remainingLock = await database.query.auditEntries.findFirst({
      where: and(eq(auditEntries.id, lockId), eq(auditEntries.shopId, shopId)),
    });

    if (remainingLock) {
      await database.delete(auditEntries).where(eq(auditEntries.id, lockId)).run();
    }
  } catch (cleanupError) {
    const postCommitError = new Error(
      `COMMITTED_LOCK_CLEANUP_PENDING: Cutover committed successfully, but mutex lock cleanup failed (${
        cleanupError instanceof Error ? cleanupError.message : cleanupError
      }). Manual cleanup required for '${lockId}'.`
    ) as CutoverCustomError;
    postCommitError.exitCode = 4;
    throw postCommitError;
  }

  // Verify marker is present
  const finalMarker = await database.query.auditEntries.findFirst({
    where: and(
      eq(
        auditEntries.id,
        options.allowRepeatCutover ? `audit:cutover:${shopId}:${releaseSha}` : `audit:cutover:${shopId}`
      ),
      eq(auditEntries.shopId, shopId)
    ),
  });

  if (!finalMarker) {
    const verifError = new Error(
      "COMMITTED_VERIFICATION_FAILED: Cutover committed, but validation of final cutover marker failed."
    ) as CutoverCustomError;
    verifError.exitCode = 3;
    throw verifError;
  }

  return cutoverResult!;
}

async function main() {
  const args = process.argv.slice(2);
  let shopId = process.env.SHOP_ID || "";
  let releaseSha = process.env.RELEASE_SHA || "";
  let runId: string | undefined;
  let correlationId: string | undefined;
  let target: "production" | "local" = "local";
  let allowRepeatCutover = false;
  let ownerApprovalReference: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--shop-id" && i + 1 < args.length) {
      shopId = args[++i];
    } else if (arg.startsWith("--shop-id=")) {
      shopId = arg.slice("--shop-id=".length);
    } else if (arg === "--release-sha" && i + 1 < args.length) {
      releaseSha = args[++i];
    } else if (arg.startsWith("--release-sha=")) {
      releaseSha = arg.slice("--release-sha=".length);
    } else if (arg === "--run-id" && i + 1 < args.length) {
      runId = args[++i];
    } else if (arg.startsWith("--run-id=")) {
      runId = arg.slice("--run-id=".length);
    } else if (arg === "--correlation-id" && i + 1 < args.length) {
      correlationId = args[++i];
    } else if (arg.startsWith("--correlation-id=")) {
      correlationId = arg.slice("--correlation-id=".length);
    } else if (arg === "--target" && i + 1 < args.length) {
      const nextArg = args[++i];
      target = nextArg === "production" ? "production" : "local";
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

  if (target === "production") {
    if (process.env.RELEASE_PREFLIGHT !== "true") {
      console.error("Error: Production cutover requires RELEASE_PREFLIGHT=true");
      process.exitCode = 2;
      return;
    }
    if (!process.env.TURSO_DATABASE_URL || process.env.TURSO_DATABASE_URL.startsWith("file:")) {
      console.error("Error: Production cutover requires remote TURSO_DATABASE_URL");
      process.exitCode = 2;
      return;
    }
    if (!process.env.TURSO_AUTH_TOKEN) {
      console.error("Error: Production cutover requires TURSO_AUTH_TOKEN");
      process.exitCode = 2;
      return;
    }
    if (!shopId) {
      console.error("Error: Production cutover requires explicit SHOP_ID");
      process.exitCode = 2;
      return;
    }
  } else {
    shopId = shopId || "shop-main";
  }

  if (!releaseSha) {
    console.error("Error: --release-sha <sha> or RELEASE_SHA is required.");
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
    const result = await runAuthCutover(database, {
      shopId,
      releaseSha,
      runId,
      correlationId,
      target,
      allowRepeatCutover,
      ownerApprovalReference,
    });

    if (result.status === "ALREADY_EXECUTED") {
      console.log(`Cutover already completed for shop ${result.shopId} at ${result.committedAt}.`);
      process.exitCode = 0;
    } else {
      console.log(`Cutover COMMITTED successfully for shop ${result.shopId}.`);
      console.log(`Sessions deleted: ${result.totalSessionsDeletedCount}, Users updated: ${result.updatedUsersCount}`);
      console.log(`Committed At: ${result.committedAt}, Run ID: ${result.runId}`);
      process.exitCode = 0;
    }
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    console.error("Auth cutover failed:", errMessage);
    const customErr = error as CutoverCustomError;
    const exitCode = customErr?.exitCode ?? (errMessage.includes("CONCURRENT_EXECUTION_REJECTED") ? 6 : 2);
    process.exitCode = exitCode;
  } finally {
    client.close();
  }
}

if (process.argv[1]?.endsWith("cutover-auth.ts") || process.argv[1]?.endsWith("cutover-auth.js")) {
  main();
}
