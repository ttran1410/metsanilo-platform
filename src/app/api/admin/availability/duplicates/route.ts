import { findAdminAvailabilityDuplicates } from "@/domain/admin-availability-actions";
import { env } from "@/lib/env";
import { failure, success } from "../../../response";
import { executeAdmin } from "../../module";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    return success(await executeAdmin(request, {
      permission: "availability.read",
      parse: async () => undefined,
      run: async (_input, { database, context }) => ({ groups: await findAdminAvailabilityDuplicates(database, { actor: context.actor, shop: { id: env().SHOP_ID } }) }),
    }));
  } catch (error) {
    return failure(error, request);
  }
}
