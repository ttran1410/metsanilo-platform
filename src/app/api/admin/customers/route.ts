import { z } from "zod";
import { db } from "@/db/client";
import { requirePermission } from "@/domain/access";
import { createCustomer, listCustomers, searchCustomers } from "@/domain/customers";
import { DomainError } from "@/domain/errors";
import { failure, success } from "../../response";

export const runtime = "nodejs";

const createSchema = z.object({
  name: z.string().min(2).max(120),
  mobile: z.string().max(40).optional().nullable().or(z.literal("")),
  email: z.string().email().optional().nullable().or(z.literal("")),
  facebookProfile: z.string().max(255).optional().nullable().or(z.literal("")),
  notes: z.string().max(2000).optional().nullable(),
});

export async function GET(request: Request) {
  try {
    await requirePermission(db(), request, "customers.read");
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? searchParams.get("search") ?? "";
    const filter = (searchParams.get("filter") ?? "all") as "all" | "vip" | "conflicts" | "consent";
    const sort = (searchParams.get("sort") ?? "recent") as "spend_desc" | "litres_desc" | "recent" | "name_asc";
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const limit = Math.max(1, Math.min(250, Number(searchParams.get("limit") ?? 150)));

    return success(
      await listCustomers(db(), {
        search: q,
        filter,
        sort,
        page,
        limit,
      }),
    );
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
      facebookProfile: parsed.data.facebookProfile || undefined,
      notes: parsed.data.notes || undefined,
    });

    return success(customer);
  } catch (error) {
    return failure(error);
  }
}
