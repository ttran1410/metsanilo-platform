import { z } from "zod";
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
import { executeAdmin, parseJson } from "../module";

export const runtime = "nodejs";

const publishCommand = z.object({ action: z.literal("publish"), draftId: z.string().uuid() });
const rollbackCommand = z.object({ action: z.literal("rollback"), versionId: z.string().uuid() });

export async function GET(request: Request) {
  try {
    return success(await executeAdmin(request, {
      permission: "settings.read",
      parse: async () => undefined,
      run: async (_input, { database }) => getStorefrontThemeState(database),
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
    await saveStorefrontThemeDraft(database, body.themeKey, actor.email ?? actor.id);
    return getStorefrontThemeState(database);
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
      await publishStorefrontThemeDraft(database, publish.data.draftId, actor.email ?? actor.id);
      return getStorefrontThemeState(database);
    }
    const rollback = rollbackCommand.safeParse(body);
    if (rollback.success) {
      await rollbackStorefrontTheme(database, rollback.data.versionId, actor.email ?? actor.id);
      return getStorefrontThemeState(database);
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
    await discardStorefrontThemeDraft(database, draftId, actor.email ?? actor.id);
    return getStorefrontThemeState(database);
      },
    });
    return success(result);
  } catch (error) {
    return failure(error);
  }
}
