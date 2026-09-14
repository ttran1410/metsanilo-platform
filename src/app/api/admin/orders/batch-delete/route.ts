import { deleteAdminOrder } from "@/domain/admin-order-actions";
import { DomainError } from "@/domain/errors";
import { executeAdminRoute, parseJson } from "../../module";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return executeAdminRoute(request, {
    permission: "orders.delete",
    parse: async (incoming) => parseJson<{ ids?: unknown }>(incoming),
    run: async ({ ids }, { database, context: { actor, shop } }) => {
      if (!Array.isArray(ids) || ids.length === 0) {
        throw new DomainError("VALIDATION_ERROR", "No order IDs provided for deletion.", 422);
      }

      const deletedIds: string[] = [];
      const skippedPaidIds: string[] = [];

      for (const id of ids) {
        try {
          await deleteAdminOrder(database, { actor, shop: { id: shop.shopId } }, id);
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
}

