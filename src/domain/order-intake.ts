import { randomBytes, randomUUID } from "node:crypto";
import { and, eq, gte, isNull, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { auditEntries, availability, customers, fulfillmentLocations, notifications, orders, outboxJobs, packages, products, shops } from "@/db/schema";
import { env } from "@/lib/env";
import { todayInTimezone } from "@/lib/format";
import { DomainError } from "./errors";
import { normalizeEmail, normalizeMobile } from "./order-input";
import { getHarvestSeasonForDate } from "./seasons";
import type { AdminActionActor } from "./admin-action-context";

export const nowIso = () => new Date().toISOString();
export const publicReference = () => `R-${randomBytes(5).toString("hex").toUpperCase()}`;

function localTimeInTimezone(timezone: string, now = new Date()) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
}

export type OrderReceipt = {
  publicReference: string;
  status: typeof orders.$inferSelect.status;
  locale: "fi" | "en";
  productName: string;
  packageLabel: string;
  volumeMl: number;
  itemSubtotalCents: number;
  deliveryFeeCents: number | null;
  finalTotalCents: number | null;
  fulfillmentDate: string;
  fulfillmentMethod: "PICKUP" | "DELIVERY";
  pickup?: { name: string; address: string; instructions: string; time: string };
  delivery?: { streetAddress: string; postalCode: string; city: string };
};

export function toReceipt(order: typeof orders.$inferSelect): OrderReceipt {
  const locale = order.locale;
  return {
    publicReference: order.publicReference,
    status: order.status,
    locale,
    productName: locale === "fi" ? order.productNameFi : order.productNameEn,
    packageLabel: locale === "fi" ? order.packageLabelFi : order.packageLabelEn,
    volumeMl: order.volumeMl,
    itemSubtotalCents: order.itemSubtotalCents,
    deliveryFeeCents: order.deliveryFeeCents,
    finalTotalCents: order.finalTotalCents,
    fulfillmentDate: order.fulfillmentDate,
    fulfillmentMethod: order.fulfillmentMethod,
    ...(order.fulfillmentMethod === "PICKUP"
      ? {
          pickup: {
            name: order.pickupName!,
            address: order.pickupAddress!,
            instructions: order.pickupInstructions!,
            time: order.pickupTime!,
          },
        }
      : {
          delivery: {
            streetAddress: order.streetAddress!,
            postalCode: order.postalCode!,
            city: order.city!,
          },
        }),
  };
}

export type PublicOrderChannelInput = {
  channel: "PUBLIC";
  shopId: string;
  locale: "fi" | "en";
  productId: string;
  packageId: string;
  quantity: number;
  fulfillmentDate: string;
  fulfillmentMethod: "PICKUP" | "DELIVERY";
  customerName: string;
  mobile?: string;
  email?: string;
  facebookProfile?: string;
  streetAddress?: string;
  postalCode?: string;
  city?: string;
  notes?: string;
  marketingConsent?: boolean;
  idempotencyKey: string;
};

export type ExternalOrderChannelInput = {
  channel: "EXTERNAL";
  shopId: string;
  actor: AdminActionActor;
  locale?: "fi" | "en";
  productId: string;
  packageId: string;
  quantity: number;
  fulfillmentDate: string;
  fulfillmentMethod: "PICKUP" | "DELIVERY";
  customerName: string;
  mobile?: string;
  email?: string;
  facebookProfile?: string;
  streetAddress?: string;
  postalCode?: string;
  city?: string;
  notes?: string;
  source: "PHONE" | "SMS" | "WHATSAPP" | "FACEBOOK" | "WEBSITE" | "OTHER";
  status: "NEW" | "CONFIRMED";
  deliveryFeeCents?: number | null;
  allowDateOverride?: boolean;
  idempotencyKey: string;
};

export type OrderIntakeChannelInput = PublicOrderChannelInput | ExternalOrderChannelInput;

export type OrderIntakeResult = {
  receipt: OrderReceipt;
  order: typeof orders.$inferSelect;
};

export type IntakeTestHooks = {
  afterReservation?: (tx: Parameters<Parameters<Database["transaction"]>[0]>[0]) => Promise<void> | void;
};

function normalizeCustomerFields(input: {
  mobile?: string;
  email?: string;
  facebookProfile?: string;
}) {
  let normalizedMobile: string | null = null;
  if (input.mobile && input.mobile.trim()) {
    try {
      normalizedMobile = normalizeMobile(input.mobile);
    } catch {
      throw new DomainError("VALIDATION_ERROR", "Invalid mobile phone number", 422, { mobile: "INVALID_PHONE" });
    }
  }

  const normalizedEmail = normalizeEmail(input.email);
  const fbProfile = input.facebookProfile?.trim() || null;

  return {
    normalizedMobile,
    normalizedEmail,
    fbProfile,
  };
}

function checkPayloadEquivalence(existing: typeof orders.$inferSelect, input: OrderIntakeChannelInput): boolean {
  const { normalizedMobile, normalizedEmail, fbProfile } = normalizeCustomerFields(input);
  if (existing.productId !== input.productId) return false;
  if (existing.packageId !== input.packageId) return false;
  if (existing.quantity !== input.quantity) return false;
  if (existing.fulfillmentDate !== input.fulfillmentDate) return false;
  if (existing.fulfillmentMethod !== input.fulfillmentMethod) return false;
  if (existing.customerName !== input.customerName.trim()) return false;
  if ((existing.mobile || null) !== normalizedMobile) return false;
  if ((existing.email || null) !== normalizedEmail) return false;
  if ((existing.facebookProfile || null) !== fbProfile) return false;

  if (input.channel === "PUBLIC") {
    if (existing.orderSource !== "WEBSITE") return false;
  } else {
    if (existing.orderSource !== input.source) return false;
    const expectedDeliveryFee = input.fulfillmentMethod === "PICKUP" ? 0 : (input.deliveryFeeCents ?? null);
    if (existing.deliveryFeeCents !== expectedDeliveryFee) return false;
  }

  return true;
}

export async function intakeOrderCore(
  database: Database,
  input: OrderIntakeChannelInput,
  hooks?: IntakeTestHooks,
): Promise<OrderIntakeResult> {
  const expectedShopId = env().SHOP_ID;
  if (input.shopId !== expectedShopId) {
    throw new DomainError("FORBIDDEN", "Shop mismatch", 403);
  }

  if (input.channel === "EXTERNAL") {
    if (!input.actor || typeof input.actor !== "object") {
      throw new DomainError("UNAUTHORIZED", "Authenticated actor is required", 401);
    }
    if (input.actor.shopId !== input.shopId) {
      throw new DomainError("FORBIDDEN", "Actor shop mismatch", 403);
    }
  }

  const key = input.idempotencyKey?.trim();
  if (!key || key.length < 1 || key.length > 64) {
    throw new DomainError("VALIDATION_ERROR", "Idempotency key must be between 1 and 64 characters", 422, {
      idempotencyKey: "INVALID_IDEMPOTENCY_KEY",
    });
  }

  const normalizedInput = {
    ...input,
    idempotencyKey: key,
  };

  const prior = await database.query.orders.findFirst({
    where: and(eq(orders.shopId, normalizedInput.shopId), eq(orders.idempotencyKey, normalizedInput.idempotencyKey)),
  });

  if (prior) {
    if (!checkPayloadEquivalence(prior, normalizedInput)) {
      throw new DomainError("IDEMPOTENCY_CONFLICT", "Idempotency key already used with different payload", 409);
    }
    return { receipt: toReceipt(prior), order: prior };
  }

  return database.transaction(async (tx) => {
    const replay = await tx.query.orders.findFirst({
      where: and(eq(orders.shopId, normalizedInput.shopId), eq(orders.idempotencyKey, normalizedInput.idempotencyKey)),
    });
    if (replay) {
      if (!checkPayloadEquivalence(replay, normalizedInput)) {
        throw new DomainError("IDEMPOTENCY_CONFLICT", "Idempotency key already used with different payload", 409);
      }
      return { receipt: toReceipt(replay), order: replay };
    }

    const catalog = await tx
      .select({ product: products, package: packages, shop: shops })
      .from(products)
      .innerJoin(
        packages,
        and(
          eq(packages.productId, products.id),
          eq(packages.shopId, products.shopId),
          eq(packages.id, normalizedInput.packageId),
        ),
      )
      .innerJoin(shops, and(eq(shops.id, products.shopId), eq(shops.id, normalizedInput.shopId)))
      .where(
        and(
          eq(products.id, normalizedInput.productId),
          eq(products.shopId, normalizedInput.shopId),
          eq(products.active, true),
          eq(packages.active, true),
          eq(shops.active, true),
        ),
      )
      .limit(1);

    const row = catalog[0];
    if (!row) throw new DomainError("NOT_AVAILABLE", "Product is unavailable", 404);

    if (row.package.volumeMl !== 10000 && normalizedInput.quantity !== 1) {
      throw new DomainError("INVALID_QUANTITY", "Only the 10 litre package supports a selectable quantity", 422);
    }
    const totalVolumeMl = row.package.volumeMl * normalizedInput.quantity;
    const itemSubtotalCents = row.package.priceCents * normalizedInput.quantity;

    const season = await getHarvestSeasonForDate(tx, row.product.id, normalizedInput.fulfillmentDate);

    let current = await tx.query.availability.findFirst({
      where: and(
        eq(availability.shopId, normalizedInput.shopId),
        eq(availability.productId, normalizedInput.productId),
        season ? eq(availability.seasonId, season.id) : isNull(availability.seasonId),
        eq(availability.businessDate, normalizedInput.fulfillmentDate),
      ),
    });

    const allowOverride = normalizedInput.channel === "EXTERNAL" && Boolean(normalizedInput.allowDateOverride);

    if (!allowOverride) {
      const today = todayInTimezone(row.shop.timezone);
      if (
        normalizedInput.fulfillmentDate < today ||
        normalizedInput.fulfillmentDate < row.product.availableFrom ||
        normalizedInput.fulfillmentDate > row.product.availableThrough
      ) {
        throw new DomainError("DATE_CLOSED", "Date is not orderable", 409);
      }

      if (
        normalizedInput.fulfillmentDate === today &&
        row.shop.sameDayCutoffEnabled &&
        localTimeInTimezone(row.shop.timezone) >= row.shop.sameDayCutoffTime
      ) {
        throw new DomainError("SAME_DAY_CUTOFF", "Same-day reservations are closed. Please choose another date.", 409);
      }

      if (!current || !current.acceptsOrders) {
        throw new DomainError("DATE_CLOSED", "Date is closed", 409);
      }
      if (current.manualSoldOut || current.capacityMl - current.reservedMl === 0) {
        throw new DomainError("SOLD_OUT", "Product is sold out", 409);
      }
    } else {
      if (!current) {
        const availId = randomUUID();
        const now = nowIso();
        await tx.insert(availability).values({
          id: availId,
          shopId: normalizedInput.shopId,
          productId: normalizedInput.productId,
          seasonId: season?.id ?? null,
          businessDate: normalizedInput.fulfillmentDate,
          capacityMl: 100000,
          reservedMl: 0,
          acceptsOrders: true,
          manualSoldOut: false,
          updatedAt: now,
        });
        current = (await tx.query.availability.findFirst({
          where: and(eq(availability.id, availId), eq(availability.shopId, normalizedInput.shopId)),
        }))!;
      } else if (current.manualSoldOut) {
        throw new DomainError("SOLD_OUT", "Product is sold out", 409);
      }
    }

    const reserved = await tx
      .update(availability)
      .set({
        reservedMl: sql`${availability.reservedMl} + ${totalVolumeMl}`,
        version: sql`${availability.version} + 1`,
        updatedAt: nowIso(),
      })
      .where(
        and(
          eq(availability.id, current.id),
          eq(availability.shopId, normalizedInput.shopId),
          eq(availability.manualSoldOut, false),
          gte(sql`${availability.capacityMl} - ${availability.reservedMl}`, totalVolumeMl),
        ),
      )
      .run();

    if (reserved.rowsAffected !== 1) {
      throw new DomainError("CAPACITY_CHANGED", "Capacity changed", 409);
    }

    if (hooks?.afterReservation) {
      await hooks.afterReservation(tx);
    }

    const pickup = normalizedInput.fulfillmentMethod === "PICKUP";
    const configuredLocation = await tx.query.fulfillmentLocations.findFirst({
      where: and(
        eq(fulfillmentLocations.shopId, normalizedInput.shopId),
        eq(fulfillmentLocations.type, pickup ? "PICKUP" : "DELIVERY_ORIGIN"),
        eq(fulfillmentLocations.active, true),
        eq(fulfillmentLocations.isDefault, true),
      ),
    });
    const locationSnapshot = configuredLocation
      ? JSON.stringify({
          id: configuredLocation.id,
          type: configuredLocation.type,
          nameFi: configuredLocation.nameFi,
          nameEn: configuredLocation.nameEn,
          address: configuredLocation.address,
          instructionsFi: configuredLocation.instructionsFi,
          instructionsEn: configuredLocation.instructionsEn,
        })
      : null;

    const { normalizedMobile, normalizedEmail, fbProfile } = normalizeCustomerFields(normalizedInput);

    if (!normalizedMobile && !fbProfile && !normalizedEmail) {
      throw new DomainError("VALIDATION_ERROR", "Contact information is required", 422);
    }

    const mobileMatch = normalizedMobile
      ? await tx.query.customers.findFirst({
          where: and(eq(customers.shopId, normalizedInput.shopId), eq(customers.mobile, normalizedMobile)),
        })
      : undefined;
    const emailMatch = normalizedEmail
      ? await tx.query.customers.findFirst({
          where: and(eq(customers.shopId, normalizedInput.shopId), eq(customers.email, normalizedEmail)),
        })
      : undefined;
    const fbMatch = fbProfile
      ? await tx.query.customers.findFirst({
          where: and(eq(customers.shopId, normalizedInput.shopId), eq(customers.facebookProfile, fbProfile)),
        })
      : undefined;

    const matchedCustomer = mobileMatch ?? emailMatch ?? fbMatch;
    const conflict = Boolean(
      (mobileMatch && emailMatch && mobileMatch.id !== emailMatch.id) ||
      (mobileMatch && normalizedEmail && mobileMatch.email && mobileMatch.email !== normalizedEmail) ||
      (fbMatch && mobileMatch && fbMatch.id !== mobileMatch.id) ||
      (fbMatch && emailMatch && fbMatch.id !== emailMatch.id),
    );

    const createdAt = nowIso();
    const consentGranted = normalizedInput.channel === "PUBLIC" && normalizedInput.marketingConsent === true;

    const customer = conflict || !matchedCustomer
      ? {
          id: randomUUID(),
          shopId: normalizedInput.shopId,
          name: normalizedInput.customerName.trim(),
          mobile: normalizedMobile,
          email: normalizedEmail,
          facebookProfile: fbProfile,
          matchStatus: conflict ? ("CONFLICT_REVIEW" as const) : ("ACTIVE" as const),
          marketingConsent: consentGranted,
          marketingConsentStatus: consentGranted ? ("CONSENTED" as const) : ("NOT_CONSENTED" as const),
          marketingConsentAt: consentGranted ? createdAt : null,
          marketingConsentSource: consentGranted ? ("ORDER_FORM" as const) : null,
          marketingConsentUpdatedBy: null,
          notes: conflict ? "Conflicting customer identifiers require staff review." : null,
          createdAt,
          updatedAt: createdAt,
        }
      : {
          ...matchedCustomer,
          name: normalizedInput.customerName.trim(),
          mobile: normalizedMobile ?? matchedCustomer.mobile,
          email: normalizedEmail ?? matchedCustomer.email,
          facebookProfile: fbProfile ?? matchedCustomer.facebookProfile,
          ...(consentGranted
            ? {
                marketingConsent: true,
                marketingConsentStatus: "CONSENTED" as const,
                marketingConsentAt: createdAt,
                marketingConsentSource: "ORDER_FORM" as const,
                marketingConsentUpdatedBy: null,
              }
            : {}),
          updatedAt: createdAt,
        };

    if (conflict || !matchedCustomer) {
      await tx.insert(customers).values(customer);
    } else {
      await tx
        .update(customers)
        .set({
          name: customer.name,
          mobile: customer.mobile,
          email: customer.email,
          facebookProfile: customer.facebookProfile,
          ...(conflict ? { matchStatus: "CONFLICT_REVIEW" as const } : {}),
          updatedAt: createdAt,
        })
        .where(and(eq(customers.id, customer.id), eq(customers.shopId, normalizedInput.shopId)));
    }

    let deliveryFeeCents: number | null = null;
    let finalTotalCents: number | null = null;

    if (pickup) {
      deliveryFeeCents = 0;
      finalTotalCents = itemSubtotalCents;
    } else {
      if (
        normalizedInput.channel === "EXTERNAL" &&
        normalizedInput.deliveryFeeCents !== undefined &&
        normalizedInput.deliveryFeeCents !== null
      ) {
        if (!Number.isSafeInteger(normalizedInput.deliveryFeeCents) || normalizedInput.deliveryFeeCents < 0) {
          throw new DomainError("VALIDATION_ERROR", "Delivery fee must be non-negative integer cents", 422, {
            deliveryFeeCents: "INVALID_DELIVERY_FEE",
          });
        }
        deliveryFeeCents = normalizedInput.deliveryFeeCents;
        finalTotalCents = itemSubtotalCents + deliveryFeeCents;
      } else {
        deliveryFeeCents = null;
        finalTotalCents = null;
      }
    }

    const orderId = randomUUID();
    const reference = publicReference();
    const isExternal = normalizedInput.channel === "EXTERNAL";
    const status = isExternal ? normalizedInput.status : "NEW";
    const orderSource = isExternal ? normalizedInput.source : "WEBSITE";
    const locale = normalizedInput.locale || "fi";
    const canonicalActor = isExternal
      ? normalizedInput.actor.email?.trim() || normalizedInput.actor.id
      : "public";

    const isConfirmed = status === "CONFIRMED";
    const contactedAt = isConfirmed ? createdAt : null;
    const contactedBy = isConfirmed ? canonicalActor : null;
    const contactChannel = isConfirmed ? (isExternal ? normalizedInput.source : "OTHER") : null;

    const createdOrder = {
      id: orderId,
      shopId: normalizedInput.shopId,
      publicReference: reference,
      idempotencyKey: normalizedInput.idempotencyKey,
      productId: row.product.id,
      customerId: customer.id,
      seasonId: season?.id ?? null,
      packageId: row.package.id,
      productNameFi: row.product.nameFi,
      productNameEn: row.product.nameEn,
      packageLabelFi: row.package.labelFi,
      packageLabelEn: row.package.labelEn,
      quantity: normalizedInput.quantity,
      volumeMl: totalVolumeMl,
      itemSubtotalCents,
      deliveryFeeCents,
      finalTotalCents,
      fulfillmentDate: normalizedInput.fulfillmentDate,
      fulfillmentMethod: normalizedInput.fulfillmentMethod,
      customerName: normalizedInput.customerName.trim(),
      mobile: normalizedMobile,
      email: normalizedEmail,
      streetAddress: pickup ? null : normalizedInput.streetAddress || null,
      postalCode: pickup ? null : normalizedInput.postalCode || null,
      city: pickup ? null : normalizedInput.city || null,
      pickupName: pickup ? (locale === "fi" ? row.shop.pickupNameFi : row.shop.pickupNameEn) : null,
      pickupAddress: pickup ? row.shop.pickupAddress : null,
      pickupInstructions: pickup
        ? locale === "fi"
          ? row.shop.pickupInstructionsFi
          : row.shop.pickupInstructionsEn
        : null,
      pickupTime: pickup ? row.shop.pickupTime : null,
      pickupLocationSnapshotJson: pickup ? locationSnapshot : null,
      deliveryOriginSnapshotJson: pickup ? null : locationSnapshot,
      notes: normalizedInput.notes?.trim() || null,
      facebookProfile: fbProfile,
      orderSource,
      historicalEntry: false,
      statusReason: isConfirmed ? "External intake confirmation" : null,
      contactedAt,
      contactedBy,
      contactChannel,
      fulfillmentStartedAt: null,
      readyAt: null,
      dispatchedAt: null,
      completedAt: null,
      pickupConfirmedAt: null,
      pickupConfirmedBy: null,
      locale,
      status,
      archived: false,
      archivedAt: null,
      archivedBy: null,
      version: 1,
      createdAt,
      updatedAt: createdAt,
    };

    await tx.insert(orders).values(createdOrder);

    if (status === "NEW") {
      await tx
        .insert(notifications)
        .values({
          id: randomUUID(),
          shopId: normalizedInput.shopId,
          eventKey: `order:${orderId}:new:v1`,
          category: "NEW_ORDER",
          title: "New order",
          body: `Order ${reference} is waiting for review.`,
          orderId,
          createdAt,
        })
        .onConflictDoNothing({ target: [notifications.shopId, notifications.eventKey] });

      await tx
        .insert(outboxJobs)
        .values({
          id: randomUUID(),
          shopId: normalizedInput.shopId,
          eventKey: `order:${orderId}:new:v1`,
          type: "NOTIFICATION",
          payloadJson: JSON.stringify({ category: "NEW_ORDER", orderId, reference }),
          status: "PENDING",
          scheduledFor: createdAt,
          attempts: 0,
          createdAt,
        })
        .onConflictDoNothing({ target: [outboxJobs.shopId, outboxJobs.eventKey] });
    }

    const auditList: Array<typeof auditEntries.$inferInsert> = [
      {
        id: randomUUID(),
        shopId: normalizedInput.shopId,
        actor: canonicalActor,
        action: "order.created",
        entityType: "order",
        entityId: orderId,
        detailsJson: JSON.stringify({
          reference,
          status,
          quantity: normalizedInput.quantity,
          volumeMl: totalVolumeMl,
          channel: normalizedInput.channel,
          source: orderSource,
        }),
        createdAt,
      },
      {
        id: randomUUID(),
        shopId: normalizedInput.shopId,
        actor: canonicalActor,
        action: "capacity.reserved",
        entityType: "availability",
        entityId: current.id,
        detailsJson: JSON.stringify({ orderId, quantity: normalizedInput.quantity, volumeMl: totalVolumeMl }),
        createdAt,
      },
    ];

    if (isConfirmed) {
      auditList.push({
        id: randomUUID(),
        shopId: normalizedInput.shopId,
        actor: canonicalActor,
        action: "order.status_changed",
        entityType: "order",
        entityId: orderId,
        detailsJson: JSON.stringify({
          from: "NEW",
          to: "CONFIRMED",
          reason: "External order intake confirmation",
          contactChannel,
        }),
        createdAt,
      });
    }

    await tx.insert(auditEntries).values(auditList);

    return {
      receipt: toReceipt(createdOrder),
      order: createdOrder,
    };
  });
}
