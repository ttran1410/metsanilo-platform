import { Suspense } from "react";
import { db } from "@/db/client";
import { getAvailabilityWorkspace, getDaysInMonth, getStartOfMonth, getStartOfWeek } from "@/domain/availability";
import { AvailabilityWorkspace } from "./workspace";
import { adminContext, hasAdminPermission } from "../portal-auth";
import { AdminRouteFrame } from "../route-frame";
import { env } from "@/lib/env";
import { todayInTimezone } from "@/lib/format";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export default async function AvailabilityPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { request } = await adminContext();
  const canRead = await hasAdminPermission(request, "availability.read");
  const canWrite = await hasAdminPermission(request, "availability.write");
  const canSoldOut = await hasAdminPermission(request, "availability.sold_out");
  const canCutoffOverride = await hasAdminPermission(request, "availability.cutoff.override");
  if (!canRead) return <AdminRouteFrame><main className="shell py-10"><p className="card" role="alert">You do not have access to availability.</p></main></AdminRouteFrame>;
  const params = await searchParams;
  const rawView = typeof params.view === "string" ? params.view.toUpperCase() : "";
  const view = rawView === "MONTH" || rawView === "TABLE" ? rawView : "WEEK";
  const requestedStart = typeof params.startDate === "string" && datePattern.test(params.startDate) ? params.startDate : undefined;
  const shopToday = todayInTimezone(env().SHOP_TIMEZONE);
  // Anchor the fetch so server data and the client pager always agree:
  // WEEK = calendar week (Mon–Sun), MONTH = calendar month, TABLE = rolling 30 days.
  const startDate =
    view === "MONTH"
      ? getStartOfMonth(requestedStart ?? shopToday)
      : view === "TABLE"
        ? (requestedStart ?? shopToday)
        : getStartOfWeek(requestedStart ?? shopToday);
  const days = view === "MONTH" ? getDaysInMonth(startDate) : view === "TABLE" ? 30 : 7;
  const database = db();
  const workspace = await getAvailabilityWorkspace(database, { startDate, days });
  return (
    <AdminRouteFrame>
      <Suspense fallback={<main className="shell py-10"><p className="card">Loading availability...</p></main>}>
        <AvailabilityWorkspace initialWorkspace={workspace} canManage={canWrite} canSoldOut={canSoldOut} canCutoffOverride={canCutoffOverride} />
      </Suspense>
    </AdminRouteFrame>
  );
}
