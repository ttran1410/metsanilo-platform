import { z } from "zod";
import { db } from "@/db/client";
import { requirePermission } from "@/domain/access";
import { DomainError } from "@/domain/errors";
import {
  listNotifications,
  markFilteredNotificationsRead,
  markNotificationReadState,
  type NotificationFilters,
  type NotificationSeverity,
  type NotificationStateFilter,
} from "@/domain/notifications";
import { failure, success } from "../../response";

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
    await requirePermission(db(), request, "notifications.read");
    const url = new URL(request.url);
    const filters = filtersFromUrl(url);
    const data = await listNotifications(db(), {
      ...filters,
      page: Number(url.searchParams.get("page") || 1),
      pageSize: url.searchParams.get("view") === "recent" ? 6 : 20,
    });
    return success(url.searchParams.get("view") === "recent" ? data.items : data);
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requirePermission(db(), request, "notifications.read");
    const body = await request.json().catch(() => ({}));
    const parsed = mutation.safeParse(body);
    if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid notification action", 422);
    if (parsed.data.action === "read" || parsed.data.action === "unread") {
      return success(await markNotificationReadState(
        db(),
        parsed.data.id,
        parsed.data.action === "read",
        actor.email ?? actor.id,
      ));
    }
    return success(await markFilteredNotificationsRead(db(), parsed.data.filters, actor.email ?? actor.id));
  } catch (error) {
    return failure(error);
  }
}
