import { db } from "@/db/client";
import { listNotifications, type NotificationSeverity, type NotificationStateFilter } from "@/domain/notifications";
import { AdminRouteFrame } from "../route-frame";
import { adminContext, hasAdminPermission } from "../portal-auth";
import { NotificationsInbox } from "./workspace";

export const dynamic = "force-dynamic";

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; category?: string; severity?: string; q?: string; page?: string }>;
}) {
  const { request } = await adminContext();
  const canReadNotifications = await hasAdminPermission(request, "notifications.read");
  if (!canReadNotifications) return <AdminRouteFrame permission="notifications.read"><div /></AdminRouteFrame>;
  const query = await searchParams;
  const state = ["ALL", "UNREAD", "READ"].includes(query.state ?? "") ? query.state as NotificationStateFilter : "UNREAD";
  const severity = ["HIGH", "STANDARD", "INFO"].includes(query.severity ?? "") ? query.severity as NotificationSeverity : undefined;
  const filters = { state, category: query.category || undefined, severity, query: query.q || undefined };
  const [initialData, canReadOrders, canReadAvailability, canReadReviews] = await Promise.all([
    listNotifications(db(), { ...filters, page: Number(query.page || 1), pageSize: 20 }),
    hasAdminPermission(request, "orders.read"),
    hasAdminPermission(request, "availability.read"),
    hasAdminPermission(request, "reviews.read"),
  ]);
  return (
    <AdminRouteFrame permission="notifications.read">
      <NotificationsInbox
        initialData={initialData}
        initialFilters={filters}
        permissions={{ canReadOrders, canReadAvailability, canReadReviews }}
      />
    </AdminRouteFrame>
  );
}
