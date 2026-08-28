import { z } from "zod";
import { DomainError } from "@/domain/errors";
import { failure, success } from "@/app/api/response";
import { executeAdmin, parseJson } from "@/app/api/admin/module";
import { updateAdminProfile } from "@/domain/admin-user-actions";

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
      run: async (input, { database, context }) => updateAdminProfile(database, { actor: context.actor, shop: { id: context.shop.shopId } }, input.displayName),
    }));
  } catch (error) { return failure(error); }
}
