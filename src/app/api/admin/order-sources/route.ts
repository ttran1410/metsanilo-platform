import { z } from "zod";
import { createAdminOrderSource, deleteAdminOrderSource, listAdminOrderSources, updateAdminOrderSource } from "@/domain/admin-order-source-actions";
import { DomainError } from "@/domain/errors";
import { executeAdminRoute, parseJson } from "@/app/api/admin/module";

const input = z.object({
  key: z.string().trim().min(2).max(40).regex(/^[A-Z0-9_]+$/),
  labelFi: z.string().trim().min(2).max(80),
  labelEn: z.string().trim().min(2).max(80),
  active: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
});

export const runtime = "nodejs";

export async function GET(request: Request) {
  return executeAdminRoute(request, {
    permission: "settings.sources.read",
    parse: async () => undefined,
    run: async (_, { database, context }) => listAdminOrderSources(database, { actor: context.actor, shop: { id: context.shop.shopId } }),
  });
}

export async function POST(request: Request) {
  return executeAdminRoute(request, {
    permission: "settings.sources.manage",
    status: 201,
    parse: async (incoming) => {
      const parsed = input.safeParse(await parseJson(incoming));
      if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid order source", 422);
      return parsed.data;
    },
    run: async (value, { database, context }) => createAdminOrderSource(database, { actor: context.actor, shop: { id: context.shop.shopId } }, value),
  });
}

export async function PATCH(request: Request) {
  return executeAdminRoute(request, {
    permission: "settings.sources.manage",
    parse: async (incoming) => {
      const body = (await parseJson(incoming)) as { id?: string } & Partial<z.infer<typeof input>>;
      if (!body.id) throw new DomainError("VALIDATION_ERROR", "Source id is required", 422);
      const parsed = input.partial().safeParse(body);
      if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid order source", 422);
      return { id: body.id, values: parsed.data };
    },
    run: async ({ id, values }, { database, context }) => updateAdminOrderSource(database, { actor: context.actor, shop: { id: context.shop.shopId } }, id, values),
  });
}

export async function DELETE(request: Request) {
  return executeAdminRoute(request, {
    permission: "settings.sources.manage",
    parse: async (incoming) => {
      const id = new URL(incoming.url).searchParams.get("id");
      if (!id) throw new DomainError("VALIDATION_ERROR", "Source id is required", 422);
      return id;
    },
    run: async (id, { database, context }) => deleteAdminOrderSource(database, { actor: context.actor, shop: { id: context.shop.shopId } }, id),
  });
}

