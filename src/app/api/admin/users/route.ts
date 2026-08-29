import { z } from "zod";
import { createUser, listUsers } from "@/domain/access";
import { DomainError } from "@/domain/errors";
import { failure, success } from "../../response";
import { adminQueryParam, hasListQuery, parseAdminListQuery } from "@/lib/admin-list-query";
import { getAdminUsers } from "@/domain/admin-users-actions";
import { executeAdmin, parseJson } from "@/app/api/admin/module";
import { emailSchema, normalizeEmail } from "@/lib/email";

export const runtime = "nodejs";
const command = z.object({
  email: z.preprocess(
    (value) => (typeof value === "string" ? normalizeEmail(value) : value),
    emailSchema,
  ),
  displayName: z.string(),
  role: z.enum(["ADMIN", "MANAGER", "STAFF", "CONTENT_CREATOR"]),
  password: z.string(),
});

export async function GET(request: Request) {
  try { return success(await executeAdmin(request, {
    permission: "shop_users.manage",
    parse: async () => request,
    run: async (input, { database, context }) => {
      if (hasListQuery(input)) return getAdminUsers(database, { actor: context.actor, shop: { id: context.shop.shopId }, request: input }, parseAdminListQuery(input), {
      role: adminQueryParam(request, "role"),
      active: adminQueryParam(request, "status") === undefined ? undefined : adminQueryParam(request, "status") === "active",
      });
      return listUsers(database, request);
    },
  })); } catch (error) { return failure(error, request); }
}

export async function POST(request: Request) {
  try { return success(await executeAdmin(request, {
    permission: "shop_users.manage",
    parse: async (input) => {
      const parsed = command.safeParse(await parseJson(input));
      if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid user", 422);
      return parsed.data;
    },
    run: (input, { database }) => createUser(database, request, input),
  }), 201); } catch (error) { return failure(error, request); }
}
