import { db } from "@/db/client";
import { getManagerOrder } from "@/domain/orders";
import { failure, success } from "../../../response";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return success(await getManagerOrder(db(), id));
  } catch (error) {
    return failure(error);
  }
}
