import { z } from "zod";
import { DomainError } from "@/domain/errors";
import { type NotificationFilters, type NotificationSeverity, type NotificationStateFilter } from "@/domain/notifications";
import { getAdminNotifications, markAdminFilteredNotificationsRead, markAdminNotificationReadState } from "@/domain/admin-notification-actions";
import { env } from "@/lib/env";
import { failure, success } from "../../response";
import { executeAdmin, parseJson } from "../module";

export const runtime = "nodejs";

const stateValues = ["ALL", "UNREAD", "READ"] as const;
const severityValues = ["HIGH", "STANDARD", "INFO"] as const;
const mutation = z.discriminatedUnion("action", [
  z.object({ action: z.literal("read"), id: z.string().min(1) }),
  z.object({ action: z.literal("unread"), id: z.string().min(1) }),
  z.object({
    action: z.literal("mark-filtered-read"),
    filters: z.object({
      state: z.enum(stateValues).optional(),
      category: z.string().max(80).optional(),
      severity: z.enum(severityValues).optional(),
      query: z.string().max(120).optional(),
    }),
  }),
]);

function filtersFromUrl(url: URL): NotificationFilters {
  const rawState = url.searchParams.get("state")?.toUpperCase();
  const rawSeverity = url.searchParams.get("severity")?.toUpperCase();
  return {
    state: stateValues.includes(rawState as NotificationStateFilter) ? rawState as NotificationStateFilter : "UNREAD",
    category: url.searchParams.get("category")?.trim() || undefined,
    severity: severityValues.includes(rawSeverity as NotificationSeverity) ? rawSeverity as NotificationSeverity : undefined,
    query: url.searchParams.get("q")?.trim() || undefined,
  };
}

export async function GET(request: Request) {
  try {
    const result = await executeAdmin(request, {
      permission: "notifications.read",
      parse: async () => new URL(request.url),
      run: async (url, { database, context }) => {
        const filters = filtersFromUrl(url);
        return getAdminNotifications(database, { actor: context.actor, shop: { id: env().SHOP_ID } }, {
          ...filters,
          page: Number(url.searchParams.get("page") || 1),
          pageSize: url.searchParams.get("view") === "recent" ? 6 : 20,
          recent: url.searchParams.get("view") === "recent",
        });
      },
    });
    return success(result);
  } catch (error) {
    return failure(error, request);
  }
}

export async function POST(request: Request) {
  try {
    const result = await executeAdmin(request, {
      permission: "notifications.read",
      parse: async (incoming) => {
        const parsed = mutation.safeParse(await parseJson<unknown>(incoming));
        if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid notification action", 422);
        return parsed.data;
      },
      run: async (input, { database, context: { actor } }) => {
        if (input.action === "read" || input.action === "unread") {
          return markAdminNotificationReadState(database, { actor, shop: { id: env().SHOP_ID } }, input.id, input.action === "read");
        }
        return markAdminFilteredNotificationsRead(database, { actor, shop: { id: env().SHOP_ID } }, input.filters);
      },
    });
    return success(result);
  } catch (error) {
    return failure(error, request);
  }
}
