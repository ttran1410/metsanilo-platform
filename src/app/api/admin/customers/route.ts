import { z } from "zod";
import { db } from "@/db/client";
import { requirePermission } from "@/domain/access";
import { createCustomer, listCustomers, searchCustomers } from "@/domain/customers";
import { DomainError } from "@/domain/errors";
import { failure, success } from "../../response";

export const runtime = "nodejs";

const createSchema = z.object({
  name: z.string().min(2).max(120),
  mobile: z.string().min(3).max(40),
  email: z.string().email().optional().or(z.literal("")),
  notes: z.string().max(2000).optional(),
});

export async function GET(request: Request) {
  try {
    await requirePermission(db(), request, "customers.read");
    const query = new URL(request.url).searchParams.get("q") ?? "";
    return success(query.trim().length >= 2 ? await searchCustomers(db(), query) : await listCustomers(db()));
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    await requirePermission(db(), request, "customers.write");
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid customer inputs", 422);

    const customer = await createCustomer(db(), {
      name: parsed.data.name,
      mobile: parsed.data.mobile,
      email: parsed.data.email || undefined,
      notes: parsed.data.notes || undefined,
    });

    return success(customer);
  } catch (error) {
    return failure(error);
  }
}
