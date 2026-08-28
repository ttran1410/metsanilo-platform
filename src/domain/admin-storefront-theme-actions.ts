import type { Database } from "@/db/client";
import { assertAdminActionContext, type AdminActionContext } from "./admin-action-context";
import { discardStorefrontThemeDraft, getStorefrontThemeState, publishStorefrontThemeDraft, rollbackStorefrontTheme, saveStorefrontThemeDraft, type StorefrontThemeKey } from "./storefront-themes";

export async function getAdminStorefrontTheme(database: Database, context: AdminActionContext) { assertAdminActionContext(context); return getStorefrontThemeState(database); }
export async function saveAdminStorefrontThemeDraft(database: Database, context: AdminActionContext, themeKey: StorefrontThemeKey) { assertAdminActionContext(context); await saveStorefrontThemeDraft(database, themeKey, context.actor.email ?? context.actor.id); return getStorefrontThemeState(database); }
export async function publishAdminStorefrontThemeDraft(database: Database, context: AdminActionContext, draftId: string) { assertAdminActionContext(context); await publishStorefrontThemeDraft(database, draftId, context.actor.email ?? context.actor.id); return getStorefrontThemeState(database); }
export async function rollbackAdminStorefrontTheme(database: Database, context: AdminActionContext, versionId: string) { assertAdminActionContext(context); await rollbackStorefrontTheme(database, versionId, context.actor.email ?? context.actor.id); return getStorefrontThemeState(database); }
export async function discardAdminStorefrontThemeDraft(database: Database, context: AdminActionContext, draftId: string) { assertAdminActionContext(context); await discardStorefrontThemeDraft(database, draftId, context.actor.email ?? context.actor.id); return getStorefrontThemeState(database); }
