import { findAdminAvailabilityDuplicates } from "@/domain/admin-availability-actions";
import { executeAdminRoute } from "../../module";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return executeAdminRoute(request, {
    permission: "availability.read",
    run: async (_input, { database, context }) => ({
      groups: await findAdminAvailabilityDuplicates(database, { actor: context.actor, shop: { id: context.shop.shopId } }),
    }),
  });
}

