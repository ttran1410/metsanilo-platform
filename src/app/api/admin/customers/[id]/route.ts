import { randomUUID } from "node:crypto";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { auditEntries, customers } from "@/db/schema";
import { authenticateAdmin, parseJson } from "../../module";
import { anonymizeCustomer, getCustomerProfile, mergeCustomers, updateCustomer } from "@/domain/customers";
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
    const actorName = actor.email ?? actor.username ?? actor.id;

    // Handle Merge Action
    if (parsed.data.action === "merge") {
      if (!parsed.data.duplicateId) {
        throw new DomainError("VALIDATION_ERROR", "duplicateId is required to merge customers", 422);
      }
      const merged = await mergeCustomers(db(), id, parsed.data.duplicateId, actorName);
      return success(merged);
    }

    // Handle Notes Action
    if (parsed.data.action === "notes") {
      const now = new Date().toISOString();
      await db()
        .update(customers)
        .set({ notes: parsed.data.notes?.trim() || null, updatedAt: now })
        .where(and(eq(customers.id, id), eq(customers.shopId, env().SHOP_ID)))
        .run();

      await db().insert(auditEntries).values({
        id: randomUUID(),
        shopId: env().SHOP_ID,
        actor: actorName,
        action: "customer.notes_updated",
        entityType: "customer",
        entityId: id,
        detailsJson: JSON.stringify({ notes: parsed.data.notes }),
        createdAt: now,
      });

      return success((await db().query.customers.findFirst({ where: eq(customers.id, id) }))!);
    }

    // Default Profile Update
    const updatedCustomer = await updateCustomer(
      db(),
      id,
      {
        name: parsed.data.name,
        mobile: parsed.data.mobile,
        email: parsed.data.email,
        facebookProfile: parsed.data.facebookProfile,
        notes: parsed.data.notes,
      },
      actorName
    );

    if (parsed.data.marketingConsent !== undefined) {
      const now = new Date().toISOString();
      const consentStatus = parsed.data.marketingConsent ? ("CONSENTED" as const) : ("REVOKED" as const);
      await db()
        .update(customers)
        .set({
          marketingConsent: parsed.data.marketingConsent,
          marketingConsentStatus: consentStatus,
          marketingConsentAt: now,
          marketingConsentSource: "ADMIN" as const,
          marketingConsentUpdatedBy: actorName,
          updatedAt: now,
        })
        .where(and(eq(customers.id, id), eq(customers.shopId, env().SHOP_ID)))
        .run();

      await db().insert(auditEntries).values({
        id: randomUUID(),
        shopId: env().SHOP_ID,
        actor: actorName,
        action: "customer.marketing_consent_updated",
        entityType: "customer",
        entityId: id,
        detailsJson: JSON.stringify({
          marketingConsent: parsed.data.marketingConsent,
          marketingConsentStatus: consentStatus,
        }),
        createdAt: now,
      });
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
    return success(await anonymizeCustomer(db(), id, actor.email ?? actor.username ?? actor.id));
  } catch (error) {
    return failure(error);
  }
}
