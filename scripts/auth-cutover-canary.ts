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
import { BETTER_AUTH_BASE_PATH } from "@/lib/auth-config";

export type CanaryRunOptions = {
  shopId: string;
  canaryUserId: string;
  releaseSha: string;
  target?: "production" | "local";
  allowRepeatCutover?: boolean;
  ownerApprovalReference?: string;
  canaryPassword?: string;
  finalCanaryPassword?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  testHooks?: {
    failCanarySessionCleanup?: boolean;
    failCanaryCredentialRevocation?: boolean;
    simulateCutoverFailure?: boolean;
  };
};

type CanaryHttpState = { cookie: string };

async function signInCanary(options: { baseUrl: string; email: string; password: string; fetchImpl: typeof fetch }): Promise<CanaryHttpState> {
  const response = await options.fetchImpl(`${options.baseUrl.replace(/\/$/, "")}${BETTER_AUTH_BASE_PATH}/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: options.baseUrl },
    body: JSON.stringify({ email: options.email, password: options.password, rememberMe: false }),
  });
  if (!response.ok) throw new Error(`CANARY_LOGIN_FAILED: sign-in returned HTTP ${response.status}`);
  const setCookie = response.headers.get("set-cookie");
  const cookie = setCookie?.split(";", 1)[0];
  if (!cookie) throw new Error("CANARY_LOGIN_FAILED: sign-in did not issue a session cookie");
  return { cookie };
}

async function checkCanaryEndpoint(fetchImpl: typeof fetch, baseUrl: string, path: string, cookie: string, expectedStatus: number) {
  const response = await fetchImpl(`${baseUrl.replace(/\/$/, "")}${path}`, {
    headers: { cookie, origin: baseUrl },
  });
  if (response.status !== expectedStatus) {
    throw new Error(`CANARY_HTTP_VERIFICATION_FAILED: ${path} returned HTTP ${response.status}, expected ${expectedStatus}`);
  }
}

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

  const bootstrapAdmin = process.env.ADMIN_BOOTSTRAP_USERNAME;
  if (bootstrapAdmin && canaryUser.email === bootstrapAdmin) {
    const err = new Error(
      `CANARY_PRECHECK_FAILED: Canary account cannot be the bootstrap admin account ('${bootstrapAdmin}').`
    ) as CanaryCustomError;
    err.exitCode = 2;
    throw err;
  }

  const activeManagers = await database.query.users.findMany({
    where: and(
      eq(users.shopId, shopId),
      eq(users.active, true),
      eq(users.role, "MANAGER")
    ),
  });

  if (activeManagers.length < 2) {
    const err = new Error(
      `CANARY_PRECHECK_FAILED: Shop '${shopId}' has ${activeManagers.length} active MANAGER(s); at least 2 are required to safely run canary rotation.`
    ) as CanaryCustomError;
    err.exitCode = 2;
    throw err;
  }

  if (options.target === "production") {
    if (process.env.RELEASE_PREFLIGHT !== "true") {
      const err = new Error(
        "CANARY_PRECHECK_FAILED: Production target requires RELEASE_PREFLIGHT=true"
      ) as CanaryCustomError;
      err.exitCode = 2;
      throw err;
    }
    if (!process.env.TURSO_DATABASE_URL || process.env.TURSO_DATABASE_URL.startsWith("file:")) {
      const err = new Error(
        "CANARY_PRECHECK_FAILED: Production target requires remote TURSO_DATABASE_URL"
      ) as CanaryCustomError;
      err.exitCode = 2;
      throw err;
    }
    if (!process.env.TURSO_AUTH_TOKEN) {
      const err = new Error(
        "CANARY_PRECHECK_FAILED: Production target requires TURSO_AUTH_TOKEN"
      ) as CanaryCustomError;
      err.exitCode = 2;
      throw err;
    }
    if (!shopId) {
      const err = new Error(
        "CANARY_PRECHECK_FAILED: Production target requires explicit SHOP_ID"
      ) as CanaryCustomError;
      err.exitCode = 2;
      throw err;
    }
    if (!options.canaryPassword && !process.env.AUTH_CUTOVER_CANARY_PASSWORD) {
      const err = new Error("CANARY_PRECHECK_FAILED: Production target requires AUTH_CUTOVER_CANARY_PASSWORD") as CanaryCustomError;
      err.exitCode = 2;
      throw err;
    }
    if (!options.finalCanaryPassword && !process.env.AUTH_CUTOVER_CANARY_FINAL_PASSWORD) {
      const err = new Error("CANARY_PRECHECK_FAILED: Production target requires AUTH_CUTOVER_CANARY_FINAL_PASSWORD") as CanaryCustomError;
      err.exitCode = 2;
      throw err;
    }
    if (!options.baseUrl && !process.env.AUTH_CUTOVER_BASE_URL && !process.env.BETTER_AUTH_URL) {
      const err = new Error("CANARY_PRECHECK_FAILED: Production target requires AUTH_CUTOVER_BASE_URL or BETTER_AUTH_URL") as CanaryCustomError;
      err.exitCode = 2;
      throw err;
    }
  }

  const canaryPassword = options.canaryPassword ?? process.env.AUTH_CUTOVER_CANARY_PASSWORD;
  const finalCanaryPassword = options.finalCanaryPassword ?? process.env.AUTH_CUTOVER_CANARY_FINAL_PASSWORD;
  const httpBaseUrl = options.baseUrl ?? process.env.AUTH_CUTOVER_BASE_URL ?? process.env.BETTER_AUTH_URL;
  if (options.target === "production" && !/^[0-9a-f]{40}$/i.test(releaseSha)) {
    throw new Error("VALIDATION_FAILED: production canary requires a full 40-character release SHA");
  }
  if (options.target === "production" && httpBaseUrl) {
    let parsedBaseUrl: URL;
    try {
      parsedBaseUrl = new URL(httpBaseUrl);
    } catch {
      throw new Error("CANARY_PRECHECK_FAILED: Production base URL is invalid");
    }
    if (parsedBaseUrl.protocol !== "https:" || ["localhost", "127.0.0.1", "::1"].includes(parsedBaseUrl.hostname)) {
      throw new Error("CANARY_PRECHECK_FAILED: Production base URL must use HTTPS and cannot target localhost");
    }
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const useHttpVerification = options.target === "production" || Boolean(canaryPassword && httpBaseUrl);

  // 2. Establish the pre-cutover session. Production always uses real HTTP login.
  const preCutoverSessionId = `canary-sess-${randomUUID()}`;
  const preCutoverToken = `canary-tok-${randomUUID()}`;
  const now = new Date();
  let preCutoverCookie: string | undefined;
  if (useHttpVerification) {
    const login = await signInCanary({ baseUrl: httpBaseUrl!, email: canaryUser.email!, password: canaryPassword!, fetchImpl });
    preCutoverCookie = login.cookie;
  } else {
    await database.insert(authSessions).values({
      id: preCutoverSessionId,
      userId: canaryUserId,
      token: preCutoverToken,
      expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
      lastActivityAt: now,
    });
  }

  // Verify pre-cutover session is active
  if (!useHttpVerification) {
    const preSessionValidation = await validateBetterAuthSession(database, preCutoverSessionId, canaryUserId, now);
    if (!preSessionValidation.valid) {
      const err = new Error("Failed to initialize pre-cutover canary session") as CanaryCustomError;
      err.exitCode = 2;
      throw err;
    }
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
    if (useHttpVerification) {
      await checkCanaryEndpoint(fetchImpl, httpBaseUrl!, "/api/auth/session", preCutoverCookie!, 401);
      await checkCanaryEndpoint(fetchImpl, httpBaseUrl!, "/api/admin/users", preCutoverCookie!, 401);
      preCutoverSessionInvalidated = true;
    } else {
      const postCutoverValidation = await validateBetterAuthSession(database, preCutoverSessionId, canaryUserId, new Date());
      preCutoverSessionInvalidated = !postCutoverValidation.valid;
    }

    if (!preCutoverSessionInvalidated) {
      throw new Error("COMMITTED_VERIFICATION_FAILED: Pre-cutover canary session remained valid after cutover!");
    }

    // 6. Assert Canary Re-Login capability
    if (useHttpVerification) {
      const postLogin = await signInCanary({ baseUrl: httpBaseUrl!, email: canaryUser.email!, password: canaryPassword!, fetchImpl });
      await checkCanaryEndpoint(fetchImpl, httpBaseUrl!, "/api/auth/session", postLogin.cookie, 200);
      postCutoverReLoginSucceeded = true;
    } else {
      const postLoginSessionId = `canary-post-${randomUUID()}`;
      const postLoginToken = `canary-post-tok-${randomUUID()}`;
      const postLoginNow = new Date();
      await database.insert(authSessions).values({ id: postLoginSessionId, userId: canaryUserId, token: postLoginToken, expiresAt: new Date(postLoginNow.getTime() + 60 * 60 * 1000), createdAt: postLoginNow, updatedAt: postLoginNow, lastActivityAt: postLoginNow });
      const postLoginValidation = await validateBetterAuthSession(database, postLoginSessionId, canaryUserId, postLoginNow);
      postCutoverReLoginSucceeded = postLoginValidation.valid;
    }

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
        password: finalCanaryPassword,
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
  let shopId = process.env.SHOP_ID || "";
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
      if (next !== "production" && next !== "local") {
        console.error(`Error: Invalid target '${next}'. Allowed targets are 'production' or 'local'.`);
        process.exitCode = 2;
        return;
      }
      target = next;
    } else if (arg.startsWith("--target=")) {
      const targetVal = arg.slice("--target=".length);
      if (targetVal !== "production" && targetVal !== "local") {
        console.error(`Error: Invalid target '${targetVal}'. Allowed targets are 'production' or 'local'.`);
        process.exitCode = 2;
        return;
      }
      target = targetVal;
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
  if (target === "production" && !/^[0-9a-f]{40}$/i.test(releaseSha)) {
    console.error("Error: Production canary requires a full 40-character release SHA.");
    process.exitCode = 2;
    return;
  }
  const expectedReleaseSha = process.env.RELEASE_COMMIT_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA;
  if (target === "production" && (!expectedReleaseSha || expectedReleaseSha.toLowerCase() !== releaseSha.toLowerCase())) {
    console.error("Error: Production canary release SHA does not match the verified deployment commit.");
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
