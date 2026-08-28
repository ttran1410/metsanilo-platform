import { z } from "zod";
import { createCustomer, listCustomers } from "@/domain/customers";
import { DomainError } from "@/domain/errors";
import { failure, success } from "../../response";
import { executeAdmin, parseJson } from "../module";

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
    const result = await executeAdmin(request, { permission: "customers.read", parse: async () => new URL(request.url).searchParams, run: async (searchParams, { database }) => {
    const q = searchParams.get("q") ?? searchParams.get("search") ?? "";
    const filter = (searchParams.get("filter") ?? "all") as "all" | "vip" | "conflicts" | "consent";
    const sort = (searchParams.get("sort") ?? "recent") as "spend_desc" | "litres_desc" | "recent" | "name_asc";
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const limit = Math.max(1, Math.min(250, Number(searchParams.get("limit") ?? 150)));
    return listCustomers(database, {
        search: q,
        filter,
        sort,
        page,
        limit,
      });
    } });
    return success(result);
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const result = await executeAdmin(request, { permission: "customers.write", parse: async (incoming) => { const parsed = createSchema.safeParse(await parseJson<unknown>(incoming)); if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid customer inputs", 422); return parsed.data; }, run: async (input, { database }) => createCustomer(database, {
      name: input.name, mobile: input.mobile, email: input.email || undefined, facebookProfile: input.facebookProfile || undefined, notes: input.notes || undefined,
    }) });
    return success(result);
  } catch (error) {
    return failure(error);
  }
}
