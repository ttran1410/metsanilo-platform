import { z } from "zod";
import { db } from "@/db/client";
import { requirePermission } from "@/domain/access";
import { DomainError } from "@/domain/errors";
import {
  discardStorefrontThemeDraft,
  getStorefrontThemeState,
  isStorefrontThemeKey,
  publishStorefrontThemeDraft,
  rollbackStorefrontTheme,
  saveStorefrontThemeDraft,
} from "@/domain/storefront-themes";
import { failure, success } from "../../response";

export const runtime = "nodejs";

const publishCommand = z.object({ action: z.literal("publish"), draftId: z.string().uuid() });
const rollbackCommand = z.object({ action: z.literal("rollback"), versionId: z.string().uuid() });

export async function GET(request: Request) {
  try {
    await requirePermission(db(), request, "settings.read");
    return success(await getStorefrontThemeState(db()));
  } catch (error) {
    return failure(error);
  }
}

export async function PUT(request: Request) {
  try {
    const actor = await requirePermission(db(), request, "theme.manage");
    const body = await request.json().catch(() => ({})) as { themeKey?: unknown };
    if (!isStorefrontThemeKey(body.themeKey)) {
      throw new DomainError("VALIDATION_ERROR", "Select one of the supported storefront themes", 422, {
        themeKey: "Unsupported storefront theme",
      });
    }
    await saveStorefrontThemeDraft(db(), body.themeKey, actor.email ?? actor.id);
    return success(await getStorefrontThemeState(db()));
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requirePermission(db(), request, "theme.manage");
    const body = await request.json().catch(() => ({}));
    const publish = publishCommand.safeParse(body);
    if (publish.success) {
      await publishStorefrontThemeDraft(db(), publish.data.draftId, actor.email ?? actor.id);
      return success(await getStorefrontThemeState(db()));
    }
    const rollback = rollbackCommand.safeParse(body);
    if (rollback.success) {
      await rollbackStorefrontTheme(db(), rollback.data.versionId, actor.email ?? actor.id);
      return success(await getStorefrontThemeState(db()));
    }
    throw new DomainError("VALIDATION_ERROR", "Invalid theme lifecycle action", 422);
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const actor = await requirePermission(db(), request, "theme.manage");
    const draftId = new URL(request.url).searchParams.get("draftId");
    if (!draftId || !z.string().uuid().safeParse(draftId).success) {
      throw new DomainError("VALIDATION_ERROR", "A valid draft ID is required", 422);
    }
    await discardStorefrontThemeDraft(db(), draftId, actor.email ?? actor.id);
    return success(await getStorefrontThemeState(db()));
  } catch (error) {
    return failure(error);
  }
}
