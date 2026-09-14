import { getAdminRetentionEligibleCustomers } from "@/domain/admin-customer-actions";
import { executeAdminRoute } from "../../module";

export async function GET(request: Request) {
  return executeAdminRoute(request, {
    permission: "customers.retention.manage",
    run: async (_input, { database, context }) => ({
      customers: await getAdminRetentionEligibleCustomers(database, { actor: context.actor, shop: { id: context.shop.shopId } }),
    }),
  });
}

