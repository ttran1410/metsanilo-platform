import { renewAdminCustomerContact } from "@/domain/admin-customer-actions";
import { executeAdminRoute } from "../../../../module";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return executeAdminRoute(request, {
    permission: "customers.retention.manage",
    parse: async () => (await context.params).id,
    run: async (customerId, { database, context: { actor, shop } }) =>
      renewAdminCustomerContact(database, { actor, shop: { id: shop.shopId } }, customerId),
  });
}

