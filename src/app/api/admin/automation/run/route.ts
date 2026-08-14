import { db } from "@/db/client";
import { requirePermission } from "@/domain/access";
import { runAutomation } from "@/domain/operations";
import { failure, success } from "../../../response";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try { await requirePermission(db(), request, "orders.transition"); return success(await runAutomation(db())); } catch (error) { return failure(error); }
}
