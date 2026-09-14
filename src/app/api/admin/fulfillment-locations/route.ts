import { z } from "zod";
import { createAdminFulfillmentLocation, deleteAdminFulfillmentLocation, listAdminFulfillmentLocations, updateAdminFulfillmentLocation } from "@/domain/admin-fulfillment-actions";
import { DomainError } from "@/domain/errors";
import { executeAdminRoute, parseJson } from "../module";

export const runtime = "nodejs";
const input = z.object({
  type: z.enum(["PICKUP", "DELIVERY_ORIGIN"]),
  nameFi: z.string().trim().min(2).max(120),
  nameEn: z.string().trim().min(2).max(120),
  address: z.string().trim().min(2).max(240),
  instructionsFi: z.string().max(1000).default(""),
  instructionsEn: z.string().max(1000).default(""),
  active: z.boolean().default(true),
  isDefault: z.boolean().default(false),
});

export async function GET(request: Request) {
  return executeAdminRoute(request, {
    permission: "settings.fulfillment.read",
    parse: async () => undefined,
    run: async (_input, { database, context: { actor, shop } }) => listAdminFulfillmentLocations(database, { actor, shop: { id: shop.shopId } }),
  });
}

export async function POST(request: Request) {
  return executeAdminRoute(request, {
    permission: "settings.fulfillment.manage",
    status: 201,
    parse: async (incoming) => {
      const parsed = input.safeParse(await parseJson<unknown>(incoming));
      if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid fulfillment location", 422);
      return parsed.data;
    },
    run: async (value, { database, context: { actor, shop } }) => createAdminFulfillmentLocation(database, { actor, shop: { id: shop.shopId } }, value),
  });
}

export async function PATCH(request: Request) {
  return executeAdminRoute(request, {
    permission: "settings.fulfillment.manage",
    parse: async (incoming) => {
      const body = await parseJson<{ id?: string } & Partial<z.infer<typeof input>>>(incoming);
      if (!body.id) throw new DomainError("VALIDATION_ERROR", "Location id is required", 422);
      const parsed = input.partial().safeParse(body);
      if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid fulfillment location", 422);
      return { id: body.id, values: parsed.data };
    },
    run: async (value, { database, context: { actor, shop } }) => updateAdminFulfillmentLocation(database, { actor, shop: { id: shop.shopId } }, value),
  });
}

export async function DELETE(request: Request) {
  return executeAdminRoute(request, {
    permission: "settings.fulfillment.manage",
    parse: async (incoming) => {
      const id = new URL(incoming.url).searchParams.get("id");
      if (!id) throw new DomainError("VALIDATION_ERROR", "Location id is required", 422);
      return id;
    },
    run: async (id, { database, context: { actor, shop } }) => deleteAdminFulfillmentLocation(database, { actor, shop: { id: shop.shopId } }, id),
  });
}

