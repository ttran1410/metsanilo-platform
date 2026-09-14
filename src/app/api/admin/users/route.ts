import { z } from "zod";
import { createUser, getAdminUsers } from "@/domain/admin-user-actions";
import { DomainError } from "@/domain/errors";
import { adminQueryParam, parseAdminListQuery } from "@/lib/admin-list-query";
import { executeAdminRoute, parseJson } from "@/app/api/admin/module";
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
  return executeAdminRoute(request, {
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
}

export async function POST(request: Request) {
  return executeAdminRoute(request, {
    permission: "shop_users.manage",
    status: 201,
    parse: async (input) => {
      const parsed = command.safeParse(await parseJson(input));
      if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid user", 422);
      return parsed.data;
    },
    run: (input, { database, context }) =>
      createUser(database, { actor: context.actor, shop: { id: context.shop.shopId } }, input),
  });
}

