import { Suspense } from "react";
import { getStartOfMonth, getStartOfWeek } from "@/domain/availability";
import { AvailabilityWorkspace } from "./workspace";
import { adminContext, hasAdminPermission } from "../portal-auth";
import { AdminRouteFrame } from "../route-frame";
import { env } from "@/lib/env";
import { todayInTimezone } from "@/lib/format";
import { parseAvailabilityUrlState } from "../availability-url-state";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AvailabilityPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { request } = await adminContext();
  const canRead = await hasAdminPermission(request, "availability.read");
  const canWrite = await hasAdminPermission(request, "availability.write");
  const canSoldOut = await hasAdminPermission(request, "availability.sold_out");
  const canCutoffOverride = await hasAdminPermission(request, "availability.cutoff.override");
  if (!canRead) return <AdminRouteFrame><main className="shell py-10"><p className="card" role="alert">You do not have access to availability.</p></main></AdminRouteFrame>;
  const params = await searchParams;
  const urlState = parseAvailabilityUrlState(new URLSearchParams(Object.entries(params).flatMap(([key, value]) => value === undefined ? [] : [[key, Array.isArray(value) ? value[0] : value]])));
  const view = urlState.viewMode;
  const requestedStart = urlState.startDate || undefined;
  const shopToday = todayInTimezone(env().SHOP_TIMEZONE);
  // Anchor the fetch so server data and the client pager always agree:
  // WEEK = calendar week (Mon–Sun), MONTH = calendar month, TABLE = rolling 30 days.
  const startDate =
    view === "MONTH"
      ? getStartOfMonth(requestedStart ?? shopToday)
      : view === "TABLE"
        ? (requestedStart ?? shopToday)
        : getStartOfWeek(requestedStart ?? shopToday);
  return (
    <AdminRouteFrame>
      <Suspense fallback={<main className="shell py-10"><p className="card">Loading availability...</p></main>}>
        <AvailabilityWorkspace initialWorkspace={{ startDate, endDate: startDate, dates: [], rows: [], products: [], ordersByDate: {}, queues: { picking: [], pickup: [], delivery: [] }, today: shopToday }} loadInitialFromApi canManage={canWrite} canSoldOut={canSoldOut} canCutoffOverride={canCutoffOverride} />
      </Suspense>
    </AdminRouteFrame>
  );
}
