import { z } from "zod";
import { clearAdminCustomerRetentionHold, setAdminCustomerRetentionHold } from "@/domain/admin-customer-actions";
import { executeAdminRoute, parseJson } from "../../../module";
import { DomainError } from "@/domain/errors";

const schema = z.object({ until: z.string().datetime(), reason: z.string().trim().min(3).max(500) });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return executeAdminRoute(request, {
    permission: "customers.retention.manage",
    parse: async (incoming) => {
      const parsed = schema.safeParse(await parseJson<unknown>(incoming));
      if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid retention hold input", 422);
      return parsed.data;
    },
    run: async (input, { database, context: { actor, shop } }) => {
      const { id } = await context.params;
      await setAdminCustomerRetentionHold(database, { actor, shop: { id: shop.shopId } }, id, input.until, input.reason);
      return { held: true };
    },
  });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  return executeAdminRoute(request, {
    permission: "customers.retention.manage",
    parse: async () => (await context.params).id,
    run: async (customerId, { database, context: { actor, shop } }) => {
      await clearAdminCustomerRetentionHold(database, { actor, shop: { id: shop.shopId } }, customerId);
      return { held: false };
    },
  });
}

