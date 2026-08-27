import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { authUsers, users } from "@/db/schema";
import { DomainError } from "@/domain/errors";
import { failure, success } from "@/app/api/response";
import { executeAdmin, parseJson } from "@/app/api/admin/module";

const update = z.object({ displayName: z.string().trim().min(2).max(120), email: z.string().optional() });

const profilePermission = "shop_users.read" as const;

export async function GET(request: Request) {
  try { return success(await executeAdmin(request, { permission: profilePermission, parse: async () => undefined, run: async (_, { context }) => { const user = context.actor; return { id: user.id, displayName: user.displayName, email: user.email, username: user.username, role: user.role, active: user.active }; } })); } catch (error) { return failure(error); }
}

export async function PATCH(request: Request) {
  try {
    return success(await executeAdmin(request, {
      permission: profilePermission,
      parse: async (input) => {
        const parsed = update.safeParse(await parseJson(input));
        if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid profile details", 422);
        if (parsed.data.email !== undefined) throw new DomainError("FORBIDDEN", "Email address cannot be changed from the profile", 403);
        return parsed.data;
      },
      run: async (input, { database, context }) => {
        const user = context.actor;
        const now = new Date().toISOString();
        const [updated] = await database.update(users).set({ displayName: input.displayName }).where(and(eq(users.id, user.id), eq(users.shopId, context.shop.shopId))).returning();
        if (!updated) throw new DomainError("NOT_FOUND", "User profile not found", 404);
        if (user.id !== "legacy-admin") await database.update(authUsers).set({ name: input.displayName, updatedAt: new Date() }).where(eq(authUsers.id, user.id));
        return { id: updated.id, displayName: updated.displayName, email: updated.email, username: updated.username, role: updated.role, active: updated.active, updatedAt: now };
      },
    }));
  } catch (error) { return failure(error); }
}
