import { z } from "zod";
import { executeAdminRoute, parseJson } from "../../module";
import { getAdminCustomerProfile } from "@/domain/admin-customer-actions";
import { anonymizeAdminCustomer, executeAdminCustomerCommand } from "@/domain/admin-customer-actions";
import { DomainError } from "@/domain/errors";

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
  return executeAdminRoute(request, {
    permission: "customers.read",
    parse: async () => (await context.params).id,
    run: async (customerId, { database, context: { actor, shop } }) => {
      const profile = await getAdminCustomerProfile(database, { actor, shop: { id: shop.shopId } }, customerId);
      if (!profile) throw new DomainError("NOT_FOUND", "Customer not found", 404);
      return profile;
    },
  });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return executeAdminRoute(request, {
    permission: "customers.write",
    parse: async (incoming) => {
      const parsed = updateSchema.safeParse(await parseJson<unknown>(incoming));
      if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid customer payload", 422);
      return parsed.data;
    },
    run: async (input, { database, context: execContext }) => {
      const { id } = await context.params;
      const actionContext = { actor: execContext.actor, shop: { id: execContext.shop.shopId } };

      if (input.action === "merge") {
        if (!input.duplicateId) {
          throw new DomainError("VALIDATION_ERROR", "duplicateId is required to merge customers", 422);
        }
        return executeAdminCustomerCommand(database, actionContext, { action: "merge", id, duplicateId: input.duplicateId });
      }

      if (input.action === "notes") {
        return executeAdminCustomerCommand(database, actionContext, { action: "notes", id, values: { notes: input.notes } });
      }

      const updatedCustomer = await executeAdminCustomerCommand(database, actionContext, {
        action: "update",
        id,
        values: {
          name: input.name,
          mobile: input.mobile,
          email: input.email,
          facebookProfile: input.facebookProfile,
          notes: input.notes,
        },
      });

      if (input.marketingConsent !== undefined) {
        await executeAdminCustomerCommand(database, actionContext, { action: "notes", id, values: { marketingConsent: input.marketingConsent } });
      }

      return updatedCustomer;
    },
  });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return executeAdminRoute(request, {
    permission: "customers.anonymize",
    parse: async () => (await context.params).id,
    run: async (customerId, { database, context: { actor, shop } }) =>
      anonymizeAdminCustomer(database, { actor, shop: { id: shop.shopId } }, customerId),
  });
}

