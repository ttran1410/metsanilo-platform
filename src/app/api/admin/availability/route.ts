import { getAdminAvailabilityWorkspace } from "@/domain/admin-availability-actions";
import { failure, success } from "../../response";
import { executeAdmin } from "../module";


export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const workspace = await executeAdmin(request, {
      permission: "availability.read",
      parse: async () => new URL(request.url).searchParams,
      run: async (searchParams, { database, context }) => getAdminAvailabilityWorkspace(database, { actor: context.actor, shop: { id: context.shop.shopId } }, {
        startDate: searchParams.get("startDate") ?? undefined,
        days: searchParams.has("days") ? Number(searchParams.get("days")) : 7,
        productId: searchParams.get("productId") ?? undefined,
        seasonId: searchParams.get("seasonId") ?? undefined,
      }),
    });
    return success(workspace);
  } catch (error) {
    return failure(error);
  }
}
