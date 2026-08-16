import { randomUUID } from "node:crypto";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { auditEntries, customers } from "@/db/schema";
import { requirePermission } from "@/domain/access";
import { getCustomerProfile, mergeCustomers } from "@/domain/customers";
import { DomainError } from "@/domain/errors";
import { normalizeEmail, normalizeMobile } from "@/domain/order-input";
import { env } from "@/lib/env";
import { failure, success } from "../../../response";

export const runtime = "nodejs";

const updateSchema = z.object({
  action: z.enum(["update", "notes", "merge"]).optional().default("update"),
  name: z.string().min(2).max(120).optional(),
  mobile: z.string().min(3).max(40).optional(),
  email: z
    .preprocess(
      (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
      z.string().email().optional().or(z.literal(""))
    )
    .optional(),
  notes: z.string().max(2000).optional(),
  marketingConsent: z.boolean().optional(),
  duplicateId: z.string().optional(),
});

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(db(), request, "customers.read");
    const { id } = await context.params;
    const profile = await getCustomerProfile(db(), id);
    if (!profile) throw new DomainError("NOT_FOUND", "Customer not found", 404);
    return success(profile);
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission(db(), request, "customers.write");
    const actorName = actor.email ?? actor.username ?? actor.id;
    const { id } = await context.params;

    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid customer payload", 422);

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
    if (!parsed.data.name || !parsed.data.mobile) {
      throw new DomainError("VALIDATION_ERROR", "Name and mobile are required for profile update", 422);
    }

    let mobile: string;
    try {
      mobile = normalizeMobile(parsed.data.mobile);
    } catch {
      throw new DomainError("VALIDATION_ERROR", "Invalid phone number", 422, { mobile: "INVALID_PHONE" });
    }

    const now = new Date().toISOString();
    const consentChanged = parsed.data.marketingConsent !== undefined;
    const consentStatus = consentChanged
      ? parsed.data.marketingConsent
        ? ("CONSENTED" as const)
        : ("REVOKED" as const)
      : undefined;

    const changed = await db()
      .update(customers)
      .set({
        name: parsed.data.name.trim(),
        mobile,
        email: normalizeEmail(parsed.data.email ?? ""),
        notes: parsed.data.notes !== undefined ? parsed.data.notes.trim() || null : undefined,
        ...(consentChanged
          ? {
              marketingConsent: parsed.data.marketingConsent,
              marketingConsentStatus: consentStatus,
              marketingConsentAt: now,
              marketingConsentSource: "ADMIN" as const,
              marketingConsentUpdatedBy: actorName,
            }
          : {}),
        updatedAt: now,
      })
      .where(and(eq(customers.id, id), eq(customers.shopId, env().SHOP_ID)))
      .run();

    if (changed.rowsAffected !== 1) throw new DomainError("NOT_FOUND", "Customer not found", 404);

    await db().insert(auditEntries).values({
      id: randomUUID(),
      shopId: env().SHOP_ID,
      actor: actorName,
      action: consentChanged ? "customer.marketing_consent_updated" : "customer.updated",
      entityType: "customer",
      entityId: id,
      detailsJson: JSON.stringify({
        fields: consentChanged ? ["marketingConsent", "marketingConsentStatus"] : ["name", "mobile", "email"],
        marketingConsent: parsed.data.marketingConsent,
        marketingConsentStatus: consentStatus,
      }),
      createdAt: now,
    });

    return success((await db().query.customers.findFirst({ where: eq(customers.id, id) }))!);
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission(db(), request, "customers.write");
    const { id } = await context.params;
    const now = new Date().toISOString();

    const changed = await db()
      .update(customers)
      .set({
        name: "Anonymized customer",
        mobile: `ANONYMIZED-${id.slice(0, 8)}`,
        email: null,
        marketingConsent: false,
        marketingConsentStatus: "REVOKED",
        marketingConsentAt: now,
        marketingConsentSource: "ADMIN",
        marketingConsentUpdatedBy: actor.email ?? actor.username ?? actor.id,
        notes: "Personal data anonymized by authorized user.",
        updatedAt: now,
      })
      .where(and(eq(customers.id, id), eq(customers.shopId, env().SHOP_ID)))
      .run();

    if (changed.rowsAffected !== 1) throw new DomainError("NOT_FOUND", "Customer not found", 404);

    await db().insert(auditEntries).values({
      id: randomUUID(),
      shopId: env().SHOP_ID,
      actor: actor.email ?? actor.username ?? actor.id,
      action: "customer.anonymized",
      entityType: "customer",
      entityId: id,
      detailsJson: JSON.stringify({
        reason: "customer request or retention policy",
        marketingConsent: false,
        marketingConsentStatus: "REVOKED",
      }),
      createdAt: now,
    });

    return success({ anonymized: true });
  } catch (error) {
    return failure(error);
  }
}
