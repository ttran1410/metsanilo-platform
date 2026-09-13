import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import type { Database } from "@/db/client";
import * as schema from "@/db/schema";
import { auditEntries, users } from "@/db/schema";
import { hashPassword, randomPassword } from "@/domain/passwords";
import { revokeAllUserSessions, setCredentialHash } from "@/lib/auth-integration";

export type RotateCanaryOptions = {
  shopId: string;
  canaryUserId: string;
  correlationId?: string;
  now?: Date;
};

export type RotateCanaryResult = {
  ok: boolean;
  userId: string;
  email: string;
  rotatedAt: string;
  auditId: string;
};

type DatabaseExecutor = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

export async function rotateCanaryCredential(
  database: Database,
  options: RotateCanaryOptions
): Promise<RotateCanaryResult> {
  const { shopId, canaryUserId, correlationId } = options;
  const now = options.now ?? new Date();
  const rotatedAt = now.toISOString();

  const executeRotation = async (tx: DatabaseExecutor): Promise<RotateCanaryResult> => {
    const user = await (tx as Database).query.users.findFirst({
      where: and(
        eq(users.id, canaryUserId),
        eq(users.shopId, shopId),
        eq(users.active, true),
        eq(users.role, "MANAGER")
      ),
    });

    if (!user) {
      throw new Error(
        `INVALID_CANARY_ACCOUNT: Canary user '${canaryUserId}' not found, not active, or not role MANAGER for shop '${shopId}'.`
      );
    }

    const newPassword = randomPassword(32);
    const newHash = hashPassword(newPassword);

    // 1. Update Better Auth credential account
    await setCredentialHash(tx as Database, user.id, newHash);

    // 2. Synchronize users.password_hash for rollback window safety
    await (tx as Database)
      .update(users)
      .set({ passwordHash: newHash })
      .where(eq(users.id, user.id));

    // 3. Revoke all active sessions for canary user
    await revokeAllUserSessions(tx as Database, user.id);

    // 4. Insert canary rotation audit record
    const auditId = `audit:canary-rotated:${shopId}:${randomUUID()}`;
    await (tx as Database).insert(auditEntries).values({
      id: auditId,
      shopId,
      actor: user.email || user.id,
      action: "auth.canary_rotated",
      entityType: "user",
      entityId: user.id,
      detailsJson: JSON.stringify({
        shopId,
        userId: user.id,
        userEmail: user.email,
        rotatedAt,
        correlationId: correlationId ?? randomUUID(),
      }),
      createdAt: rotatedAt,
    });

    return {
      ok: true,
      userId: user.id,
      email: user.email || "",
      rotatedAt,
      auditId,
    };
  };

  if (typeof database.transaction === "function") {
    return await database.transaction(async (tx) => executeRotation(tx));
  }
  return await executeRotation(database);
}

async function main() {
  const args = process.argv.slice(2);
  let shopId = process.env.SHOP_ID || "";
  let canaryUserId: string | undefined;
  let correlationId: string | undefined;
  let target = "local";

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
    } else if (arg === "--correlation-id" && i + 1 < args.length) {
      correlationId = args[++i];
    } else if (arg.startsWith("--correlation-id=")) {
      correlationId = arg.slice("--correlation-id=".length);
    } else if (arg === "--target" && i + 1 < args.length) {
      target = args[++i];
    } else if (arg.startsWith("--target=")) {
      target = arg.slice("--target=".length);
    }
  }

  if (target === "production") {
    if (process.env.RELEASE_PREFLIGHT !== "true") {
      console.error("Error: Production rotation requires RELEASE_PREFLIGHT=true");
      process.exitCode = 2;
      return;
    }
    if (!process.env.TURSO_DATABASE_URL || process.env.TURSO_DATABASE_URL.startsWith("file:")) {
      console.error("Error: Production target requires remote TURSO_DATABASE_URL");
      process.exitCode = 2;
      return;
    }
    if (!process.env.TURSO_AUTH_TOKEN) {
      console.error("Error: Production target requires TURSO_AUTH_TOKEN");
      process.exitCode = 2;
      return;
    }
    if (!shopId) {
      console.error("Error: Production target requires explicit SHOP_ID");
      process.exitCode = 2;
      return;
    }
  } else {
    shopId = shopId || "shop-main";
  }

  if (!canaryUserId) {
    console.error("Error: --canary-user-id <userId> is required.");
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
    const result = await rotateCanaryCredential(database, {
      shopId,
      canaryUserId,
      correlationId,
    });

    console.log(`Canary credential rotated successfully for user ${result.userId} (${result.email}).`);
    console.log(`Audit ID: ${result.auditId}`);
    process.exitCode = 0;
  } catch (error) {
    console.error("Canary rotation failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    client.close();
  }
}

if (process.argv[1]?.endsWith("rotate-canary-credential.ts") || process.argv[1]?.endsWith("rotate-canary-credential.js")) {
  main();
}
