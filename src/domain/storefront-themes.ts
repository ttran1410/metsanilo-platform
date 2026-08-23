import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { auditEntries, shops, storefrontThemeVersions } from "@/db/schema";
import { DomainError } from "./errors";
import { env } from "@/lib/env";

export const STOREFRONT_THEME_KEYS = ["forest-harvest", "nordic-ink", "berry-season"] as const;
export type StorefrontThemeKey = (typeof STOREFRONT_THEME_KEYS)[number];

export function isStorefrontThemeKey(value: unknown): value is StorefrontThemeKey {
  return typeof value === "string" && (STOREFRONT_THEME_KEYS as readonly string[]).includes(value);
}

export function resolveStorefrontTheme(value: unknown): StorefrontThemeKey {
  return isStorefrontThemeKey(value) ? value : "forest-harvest";
}

export async function getStorefrontThemeState(database: Database) {
  const shopId = env().SHOP_ID;
  const [shop, versions] = await Promise.all([
    database.query.shops.findFirst({ where: eq(shops.id, shopId) }),
    database
      .select()
      .from(storefrontThemeVersions)
      .where(eq(storefrontThemeVersions.shopId, shopId))
      .orderBy(desc(storefrontThemeVersions.version)),
  ]);
  if (!shop) throw new DomainError("NOT_FOUND", "Shop not found", 404);
  return {
    publishedTheme: resolveStorefrontTheme(shop.storefrontTheme),
    draft: versions.find((item) => item.status === "DRAFT") ?? null,
    versions: versions.filter((item) => item.status !== "DRAFT" && item.status !== "DISCARDED").slice(0, 12),
  };
}

export async function saveStorefrontThemeDraft(database: Database, themeKey: StorefrontThemeKey, actor: string) {
  const shopId = env().SHOP_ID;
  const now = new Date().toISOString();
  return database.transaction(async (tx) => {
    const shop = await tx.query.shops.findFirst({ where: eq(shops.id, shopId) });
    if (!shop) throw new DomainError("NOT_FOUND", "Shop not found", 404);
    const existingDraft = await tx.query.storefrontThemeVersions.findFirst({
      where: and(eq(storefrontThemeVersions.shopId, shopId), eq(storefrontThemeVersions.status, "DRAFT")),
      orderBy: desc(storefrontThemeVersions.version),
    });
    let draft;
    if (existingDraft) {
      [draft] = await tx
        .update(storefrontThemeVersions)
        .set({ themeKey, updatedAt: now })
        .where(and(eq(storefrontThemeVersions.id, existingDraft.id), eq(storefrontThemeVersions.shopId, shopId)))
        .returning();
    } else {
      const latest = await tx.query.storefrontThemeVersions.findFirst({
        where: eq(storefrontThemeVersions.shopId, shopId),
        orderBy: desc(storefrontThemeVersions.version),
      });
      [draft] = await tx
        .insert(storefrontThemeVersions)
        .values({
          id: randomUUID(),
          shopId,
          version: (latest?.version ?? 0) + 1,
          themeKey,
          status: "DRAFT",
          createdBy: actor,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
    }
    await tx.insert(auditEntries).values({
      id: randomUUID(),
      shopId,
      actor,
      action: "theme.draft_saved",
      entityType: "storefront_theme",
      entityId: draft.id,
      detailsJson: JSON.stringify({ version: draft.version, themeKey }),
      createdAt: now,
    });
    return draft;
  });
}

export async function publishStorefrontThemeDraft(database: Database, draftId: string, actor: string) {
  const shopId = env().SHOP_ID;
  const now = new Date().toISOString();
  return database.transaction(async (tx) => {
    const [shop, draft] = await Promise.all([
      tx.query.shops.findFirst({ where: eq(shops.id, shopId) }),
      tx.query.storefrontThemeVersions.findFirst({
        where: and(
          eq(storefrontThemeVersions.id, draftId),
          eq(storefrontThemeVersions.shopId, shopId),
          eq(storefrontThemeVersions.status, "DRAFT"),
        ),
      }),
    ]);
    if (!shop) throw new DomainError("NOT_FOUND", "Shop not found", 404);
    if (!draft) throw new DomainError("STALE_VERSION", "Theme draft changed. Reload Settings and try again.", 409);

    await tx
      .update(storefrontThemeVersions)
      .set({ status: "SUPERSEDED", updatedAt: now })
      .where(and(eq(storefrontThemeVersions.shopId, shopId), eq(storefrontThemeVersions.status, "PUBLISHED")));
    await tx
      .update(storefrontThemeVersions)
      .set({ status: "PUBLISHED", publishedBy: actor, publishedAt: now, updatedAt: now })
      .where(and(eq(storefrontThemeVersions.id, draft.id), eq(storefrontThemeVersions.shopId, shopId)));
    await tx.update(shops).set({ storefrontTheme: draft.themeKey }).where(eq(shops.id, shopId));
    await tx.insert(auditEntries).values({
      id: randomUUID(),
      shopId,
      actor,
      action: "theme.published",
      entityType: "storefront_theme",
      entityId: draft.id,
      detailsJson: JSON.stringify({
        version: draft.version,
        before: { themeKey: resolveStorefrontTheme(shop.storefrontTheme) },
        after: { themeKey: draft.themeKey },
      }),
      createdAt: now,
    });
    return { ...draft, status: "PUBLISHED" as const, publishedBy: actor, publishedAt: now, updatedAt: now };
  });
}

export async function rollbackStorefrontTheme(database: Database, versionId: string, actor: string) {
  const shopId = env().SHOP_ID;
  const now = new Date().toISOString();
  return database.transaction(async (tx) => {
    const [shop, target, latest] = await Promise.all([
      tx.query.shops.findFirst({ where: eq(shops.id, shopId) }),
      tx.query.storefrontThemeVersions.findFirst({
        where: and(eq(storefrontThemeVersions.id, versionId), eq(storefrontThemeVersions.shopId, shopId)),
      }),
      tx.query.storefrontThemeVersions.findFirst({
        where: eq(storefrontThemeVersions.shopId, shopId),
        orderBy: desc(storefrontThemeVersions.version),
      }),
    ]);
    if (!shop) throw new DomainError("NOT_FOUND", "Shop not found", 404);
    if (!target || !["PUBLISHED", "SUPERSEDED"].includes(target.status)) {
      throw new DomainError("VALIDATION_ERROR", "Only a previously published theme can be restored", 422);
    }

    await tx
      .update(storefrontThemeVersions)
      .set({ status: "DISCARDED", updatedAt: now })
      .where(and(eq(storefrontThemeVersions.shopId, shopId), eq(storefrontThemeVersions.status, "DRAFT")));
    await tx
      .update(storefrontThemeVersions)
      .set({ status: "SUPERSEDED", updatedAt: now })
      .where(and(eq(storefrontThemeVersions.shopId, shopId), eq(storefrontThemeVersions.status, "PUBLISHED")));
    const [restored] = await tx
      .insert(storefrontThemeVersions)
      .values({
        id: randomUUID(),
        shopId,
        version: (latest?.version ?? 0) + 1,
        themeKey: target.themeKey,
        status: "PUBLISHED",
        createdBy: actor,
        createdAt: now,
        updatedAt: now,
        publishedBy: actor,
        publishedAt: now,
      })
      .returning();
    await tx.update(shops).set({ storefrontTheme: target.themeKey }).where(eq(shops.id, shopId));
    await tx.insert(auditEntries).values({
      id: randomUUID(),
      shopId,
      actor,
      action: "theme.rolled_back",
      entityType: "storefront_theme",
      entityId: restored.id,
      detailsJson: JSON.stringify({
        restoredFromVersion: target.version,
        version: restored.version,
        before: { themeKey: resolveStorefrontTheme(shop.storefrontTheme) },
        after: { themeKey: target.themeKey },
      }),
      createdAt: now,
    });
    return restored;
  });
}

export async function discardStorefrontThemeDraft(database: Database, draftId: string, actor: string) {
  const shopId = env().SHOP_ID;
  const now = new Date().toISOString();
  const [draft] = await database
    .update(storefrontThemeVersions)
    .set({ status: "DISCARDED", updatedAt: now })
    .where(and(
      eq(storefrontThemeVersions.id, draftId),
      eq(storefrontThemeVersions.shopId, shopId),
      eq(storefrontThemeVersions.status, "DRAFT"),
    ))
    .returning();
  if (!draft) throw new DomainError("STALE_VERSION", "Theme draft changed. Reload Settings and try again.", 409);
  await database.insert(auditEntries).values({
    id: randomUUID(),
    shopId,
    actor,
    action: "theme.draft_discarded",
    entityType: "storefront_theme",
    entityId: draft.id,
    detailsJson: JSON.stringify({ version: draft.version, themeKey: draft.themeKey }),
    createdAt: now,
  });
  return draft;
}
