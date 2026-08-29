import { getAdminRetentionEligibleCustomers } from "@/domain/admin-customer-actions";
import { failure, success } from "../../../response";
import { executeAdmin } from "../../module";

export async function GET(request: Request) {
  try {
    const result = await executeAdmin(request, { permission: "customers.retention.manage", parse: async () => undefined, run: async (_input, { database, context }) => ({ customers: await getAdminRetentionEligibleCustomers(database, { actor: context.actor, shop: { id: context.shop.shopId } }) }) });
    return success(result);
  } catch (error) {
    return failure(error, request);
  }
}
