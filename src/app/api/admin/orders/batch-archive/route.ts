import { failure, success } from "../../../response";
import { archiveManagerOrder, unarchiveManagerOrder } from "@/domain/orders";
import { DomainError } from "@/domain/errors";
import { executeAdmin, parseJson } from "../../module";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const result = await executeAdmin(request, {
      permission: "orders.archive",
      parse: async (incoming) => parseJson<{ ids?: unknown; action?: string }>(incoming),
      run: async ({ ids, action = "archive" }, { database, context: { actor } }) => {

    if (!Array.isArray(ids) || ids.length === 0) {
      throw new DomainError("VALIDATION_ERROR", "No order IDs provided for batch operation.", 422);
    }

    const processedIds: string[] = [];
    const skippedActiveIds: string[] = [];

    for (const id of ids) {
      try {
        if (action === "unarchive") {
          await unarchiveManagerOrder(database, id, actor.email ?? undefined);
        } else {
          await archiveManagerOrder(database, id, actor.email ?? undefined);
        }
        processedIds.push(id);
      } catch (err: unknown) {
        if (err instanceof DomainError && (err.code === "INVALID_TRANSITION" || err.status === 400)) {
          skippedActiveIds.push(id);
        } else {
          throw err;
        }
      }
    }

    return {
      action,
      processedCount: processedIds.length,
      processedIds,
      skippedActiveCount: skippedActiveIds.length,
      skippedActiveIds,
    };
      },
    });
    return success(result);
  } catch (error) {
    return failure(error);
  }
}
