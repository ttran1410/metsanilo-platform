import { z } from "zod";
import { db } from "@/db/client";
import { authenticateAdmin, parseJson } from "../../module";
import { getCustomerProfile } from "@/domain/customers";
import { anonymizeAdminCustomer, mergeAdminCustomers, updateAdminCustomer, updateAdminCustomerNotesAndConsent } from "@/domain/admin-customer-actions";
import { DomainError } from "@/domain/errors";
import { env } from "@/lib/env";
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
    await authenticateAdmin(request, "customers.read");
    const profile = await getCustomerProfile(db(), id);
    if (!profile) throw new DomainError("NOT_FOUND", "Customer not found", 404);
    return success(profile);
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;

    const parsed = updateSchema.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid customer payload", 422);
    const actor = (await authenticateAdmin(request, "customers.write")).actor;

    // Handle Merge Action
    if (parsed.data.action === "merge") {
      if (!parsed.data.duplicateId) {
        throw new DomainError("VALIDATION_ERROR", "duplicateId is required to merge customers", 422);
      }
      const merged = await mergeAdminCustomers(db(), { actor, shop: { id: env().SHOP_ID } }, id, parsed.data.duplicateId);
      return success(merged);
    }

    // Handle Notes Action
    if (parsed.data.action === "notes") {
      return success(await updateAdminCustomerNotesAndConsent(db(), { actor, shop: { id: env().SHOP_ID } }, id, { notes: parsed.data.notes }));
    }

    // Default Profile Update
    const updatedCustomer = await updateAdminCustomer(db(), { actor, shop: { id: env().SHOP_ID } }, id,
      {
        name: parsed.data.name,
        mobile: parsed.data.mobile,
        email: parsed.data.email,
        facebookProfile: parsed.data.facebookProfile,
        notes: parsed.data.notes,
      });

    if (parsed.data.marketingConsent !== undefined) {
      await updateAdminCustomerNotesAndConsent(db(), { actor, shop: { id: env().SHOP_ID } }, id, { marketingConsent: parsed.data.marketingConsent });
    }

    return success(updatedCustomer);
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = (await authenticateAdmin(request, "customers.anonymize")).actor;
    const { id } = await context.params;
    return success(await anonymizeAdminCustomer(db(), { actor, shop: { id: env().SHOP_ID } }, id));
  } catch (error) {
    return failure(error);
  }
}
