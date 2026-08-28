import { db } from "@/db/client";
import { listNotifications } from "@/domain/notifications";
import { AdminRouteFrame } from "../route-frame";
import { adminContext, hasAdminPermission } from "../portal-auth";
import { NotificationsInbox } from "./workspace";
import { parseNotificationsUrlState } from "../notifications-url-state";

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
  const urlState = parseNotificationsUrlState(new URLSearchParams(Object.entries(query).flatMap(([key, value]) => value === undefined ? [] : [[key, value]])));
  const filters = { state: urlState.state, category: urlState.category, severity: urlState.severity, query: urlState.query };
  const [initialData, canReadOrders, canReadAvailability, canReadReviews] = await Promise.all([
    listNotifications(db(), { ...filters, page: urlState.page, pageSize: 20 }),
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
