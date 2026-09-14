import { z } from "zod";
import { createUser, getAdminUsers } from "@/domain/admin-user-actions";
import { DomainError } from "@/domain/errors";
import { failure, success } from "../../response";
import { adminQueryParam, parseAdminListQuery } from "@/lib/admin-list-query";
import { executeAdmin, parseJson } from "@/app/api/admin/module";
import { emailSchema, normalizeEmail } from "@/lib/email";

export const runtime = "nodejs";
const command = z.object({
  email: z.preprocess(
    (value) => (typeof value === "string" ? normalizeEmail(value) : value),
    emailSchema,
  ),
  displayName: z.string().trim().min(2).max(120),
  role: z.enum(["ADMIN", "MANAGER", "STAFF", "CONTENT_CREATOR"]),
  password: z.string().min(8),
});

export async function GET(request: Request) {
  try {
    const result = await executeAdmin(request, {
      permission: "shop_users.read",
      parse: async () => parseAdminListQuery(request),
      run: async (query, { database, context }) => {
        return getAdminUsers(
          database,
          { actor: context.actor, shop: { id: context.shop.shopId } },
          query,
          {
            role: adminQueryParam(request, "role"),
            active: adminQueryParam(request, "status") === undefined ? undefined : adminQueryParam(request, "status") === "active",
          },
        );
      },
    });
    return success(result, request);
  } catch (error) {
    return failure(error, request);
  }
}

export async function POST(request: Request) {
  try {
    const result = await executeAdmin(request, {
      permission: "shop_users.manage",
      parse: async (input) => {
        const parsed = command.safeParse(await parseJson(input));
        if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid user", 422);
        return parsed.data;
      },
      run: (input, { database, context }) =>
        createUser(database, { actor: context.actor, shop: { id: context.shop.shopId } }, input),
    });
    return success(result, request, 201);
  } catch (error) {
    return failure(error, request);
  }
}
