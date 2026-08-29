import { z } from "zod";
import { authenticateAdmin, authenticateAdminAny, parseJson, executeAdmin } from "../../module";
import { getAdminCustomerProfile } from "@/domain/admin-customer-actions";
import { anonymizeAdminCustomer, executeAdminCustomerCommand } from "@/domain/admin-customer-actions";
import { DomainError } from "@/domain/errors";
import { failure, success } from "../../../response";

export const runtime = "nodejs";

const updateSchema = z.object({
  action: z.enum(["update", "notes", "merge"]).optional().default("update"),
  name: z.string().min(2).max(120).optional(),
  mobile: z.string().max(40).optional().nullable().or(z.literal("")),
  email: z
    .preprocess(
      (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
      z.string().email().optional().nullable().or(z.literal(""))
    )
    .optional(),
  facebookProfile: z.string().max(255).optional().nullable().or(z.literal("")),
  notes: z.string().max(2000).optional().nullable(),
  marketingConsent: z.boolean().optional(),
  duplicateId: z.string().optional(),
});

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const profile = await executeAdmin(request, { permission: "customers.read", parse: async () => id, run: async (customerId, { database, context: { actor, shop } }) => getAdminCustomerProfile(database, { actor, shop: { id: shop.shopId } }, customerId) });
    if (!profile) throw new DomainError("NOT_FOUND", "Customer not found", 404);
    return success(profile);
  } catch (error) {
    return failure(error, request);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    await authenticateAdminAny(request, ["customers.write"]);

    const parsed = updateSchema.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid customer payload", 422);
    await authenticateAdmin(request, "customers.write");

    // Handle Merge Action
    if (parsed.data.action === "merge") {
      if (!parsed.data.duplicateId) {
        throw new DomainError("VALIDATION_ERROR", "duplicateId is required to merge customers", 422);
      }
      const merged = await executeAdmin(request, { permission: "customers.write", parse: async () => parsed.data, run: async (input, { database, context }) => executeAdminCustomerCommand(database, { actor: context.actor, shop: { id: context.shop.shopId } }, { action: "merge", id, duplicateId: input.duplicateId! }) });
      return success(merged);
    }

    // Handle Notes Action
    if (parsed.data.action === "notes") {
      const result = await executeAdmin(request, { permission: "customers.write", parse: async () => parsed.data, run: async (input, { database, context }) => executeAdminCustomerCommand(database, { actor: context.actor, shop: { id: context.shop.shopId } }, { action: "notes", id, values: { notes: input.notes } }) });
      return success(result);
    }

    // Default Profile Update
    const updatedCustomer = await executeAdmin(request, { permission: "customers.write", parse: async () => parsed.data, run: async (input, { database, context }) => executeAdminCustomerCommand(database, { actor: context.actor, shop: { id: context.shop.shopId } }, { action: "update", id, values: {
        name: input.name, mobile: input.mobile, email: input.email, facebookProfile: input.facebookProfile, notes: input.notes,
      } }) });

    if (parsed.data.marketingConsent !== undefined) {
      await executeAdmin(request, { permission: "customers.write", parse: async () => parsed.data.marketingConsent, run: async (marketingConsent, { database, context }) => executeAdminCustomerCommand(database, { actor: context.actor, shop: { id: context.shop.shopId } }, { action: "notes", id, values: { marketingConsent } }) });
    }

    return success(updatedCustomer);
  } catch (error) {
    return failure(error, request);
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const result = await executeAdmin(request, { permission: "customers.anonymize", parse: async () => id, run: async (customerId, { database, context: { actor, shop } }) => anonymizeAdminCustomer(database, { actor, shop: { id: shop.shopId } }, customerId) });
    return success(result);
  } catch (error) {
    return failure(error, request);
  }
}
