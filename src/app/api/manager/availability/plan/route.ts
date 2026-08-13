import { z } from "zod";
import { db } from "@/db/client";
import { planAvailability } from "@/domain/availability";
import { DomainError } from "@/domain/errors";
import { failure, success } from "../../../response";
import { requirePermission } from "@/domain/access";

export const runtime = "nodejs";

const command = z.object({
  productId: z.string().min(1),
  frequency: z.enum(["DAY", "WEEK", "MONTH", "CUSTOM"]),
  startDate: z.string(),
  endDate: z.string(),
  dates: z.array(z.string()).optional(),
  capacityMl: z.number().int().nonnegative(),
  manualSoldOut: z.boolean().default(false),
  soldOutReason: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  try {
    const parsed = command.safeParse(await request.json());
    if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid availability plan", 422);
    await requirePermission(db(), request, parsed.data.manualSoldOut ? "availability.sold_out" : "availability.write");
    return success(await planAvailability(db(), parsed.data));
  } catch (error) {
    return failure(error);
  }
}
