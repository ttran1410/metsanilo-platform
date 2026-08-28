import { failure, success } from "../../../response";
import { deleteAdminOrder } from "@/domain/admin-order-actions";
import { env } from "@/lib/env";
import { DomainError } from "@/domain/errors";
import { executeAdmin, parseJson } from "../../module";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const result = await executeAdmin(request, {
      permission: "orders.delete",
      parse: async (incoming) => parseJson<{ ids?: unknown }>(incoming),
      run: async ({ ids }, { database, context: { actor } }) => {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new DomainError("VALIDATION_ERROR", "No order IDs provided for deletion.", 422);
    }

    const deletedIds: string[] = [];
    const skippedPaidIds: string[] = [];

    for (const id of ids) {
      try {
        await deleteAdminOrder(database, { actor, shop: { id: env().SHOP_ID } }, id);
        deletedIds.push(id);
      } catch (err: unknown) {
        if (err instanceof DomainError && (err.code === "PAYMENT_EXISTS" || err.status === 400)) {
          skippedPaidIds.push(id);
        } else {
          throw err;
        }
      }
    }

    return {
      deletedCount: deletedIds.length,
      deletedIds,
      skippedPaidCount: skippedPaidIds.length,
      skippedPaidIds,
    };
      },
    });
    return success(result);
  } catch (error) {
    return failure(error);
  }
}
