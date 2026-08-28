import { z } from "zod";
import { DomainError } from "@/domain/errors";
import { env } from "@/lib/env";
import {
  isStorefrontThemeKey,
} from "@/domain/storefront-themes";
import { discardAdminStorefrontThemeDraft, getAdminStorefrontTheme, publishAdminStorefrontThemeDraft, rollbackAdminStorefrontTheme, saveAdminStorefrontThemeDraft } from "@/domain/admin-storefront-theme-actions";
import { failure, success } from "../../response";
import { executeAdmin, parseJson } from "../module";

export const runtime = "nodejs";

const publishCommand = z.object({ action: z.literal("publish"), draftId: z.string().uuid() });
const rollbackCommand = z.object({ action: z.literal("rollback"), versionId: z.string().uuid() });

export async function GET(request: Request) {
  try {
    return success(await executeAdmin(request, {
      permission: "settings.read",
      parse: async () => undefined,
      run: async (_input, { database, context }) => getAdminStorefrontTheme(database, { actor: context.actor, shop: { id: env().SHOP_ID } }),
    }));
  } catch (error) {
    return failure(error);
  }
}

export async function PUT(request: Request) {
  try {
    const result = await executeAdmin(request, {
      permission: "theme.manage",
      parse: async (incoming) => parseJson<{ themeKey?: unknown }>(incoming),
      run: async (body, { database, context: { actor } }) => {
    if (!isStorefrontThemeKey(body.themeKey)) {
      throw new DomainError("VALIDATION_ERROR", "Select one of the supported storefront themes", 422, {
        themeKey: "Unsupported storefront theme",
      });
    }
    return saveAdminStorefrontThemeDraft(database, { actor, shop: { id: env().SHOP_ID } }, body.themeKey);
      },
    });
    return success(result);
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const result = await executeAdmin(request, {
      permission: "theme.manage",
      parse: async (incoming) => parseJson<unknown>(incoming),
      run: async (body, { database, context: { actor } }) => {
    const publish = publishCommand.safeParse(body);
    if (publish.success) {
      return publishAdminStorefrontThemeDraft(database, { actor, shop: { id: env().SHOP_ID } }, publish.data.draftId);
    }
    const rollback = rollbackCommand.safeParse(body);
    if (rollback.success) {
      return rollbackAdminStorefrontTheme(database, { actor, shop: { id: env().SHOP_ID } }, rollback.data.versionId);
    }
    throw new DomainError("VALIDATION_ERROR", "Invalid theme lifecycle action", 422);
      },
    });
    return success(result);
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const result = await executeAdmin(request, {
      permission: "theme.manage",
      parse: async () => new URL(request.url).searchParams.get("draftId"),
      run: async (draftId, { database, context: { actor } }) => {
    if (!draftId || !z.string().uuid().safeParse(draftId).success) {
      throw new DomainError("VALIDATION_ERROR", "A valid draft ID is required", 422);
    }
    return discardAdminStorefrontThemeDraft(database, { actor, shop: { id: env().SHOP_ID } }, draftId);
      },
    });
    return success(result);
  } catch (error) {
    return failure(error);
  }
}
