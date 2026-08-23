"use client";

import Link from "next/link";
import { LockKeyhole, MapPin, Pencil, Truck, UnlockKeyhole, X } from "lucide-react";
import { AdminNotice, AdminStatusBadge, formatAdminMoney } from "../presentation";

type OrderItem = {
  id: string;
  publicReference: string;
  customerName: string;
  mobile: string;
  productId: string;
  productNameFi: string;
  packageLabelFi: string;
  volumeMl: number;
  priceCents: number;
  status: string;
  fulfillmentMethod: "PICKUP" | "DELIVERY";
};

export type DateOrdersEntry = {
  pickupVolumeMl: number;
  pickupCount: number;
  deliveryVolumeMl: number;
  deliveryCount: number;
  totalRevenueCents: number;
  orders: OrderItem[];
};

function formatLitres(ml: number) {
  return `${(ml / 1000).toLocaleString("fi-FI", { maximumFractionDigits: 1 })} L`;
}

export function DateInspectorDrawer({
  date,
  capacityMl,
  reservedMl,
  soldOut,
  soldOutReason,
  productName,
  ordersData,
  canManage,
  canSoldOut,
  onClose,
  onEditCapacity,
  onFreeze,
}: {
  date: string;
  capacityMl: number;
  reservedMl: number;
  soldOut: boolean;
  soldOutReason?: string | null;
  productName: string;
  ordersData?: DateOrdersEntry;
  canManage: boolean;
  canSoldOut: boolean;
  onClose: () => void;
  onEditCapacity?: () => void;
  onFreeze: () => void;
}) {
  const remainingMl = Math.max(0, capacityMl - reservedMl);
  const utilization = capacityMl > 0 ? Math.round((reservedMl / capacityMl) * 100) : 0;

  const dayParsed = new Date(`${date}T12:00:00Z`);
  const formattedDate = dayParsed.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div
      className="availability-inspector-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <aside className="availability-inspector" role="dialog" aria-modal="true" aria-labelledby="availability-inspector-title">
        {/* Drawer Header */}
        <div className="availability-inspector-header">
          <div>
            <span className="eyebrow">Date inspector</span>
            <h3 id="availability-inspector-title" className="text-base font-bold text-ink">{formattedDate}</h3>
            <span className="text-xs muted font-semibold block">{productName}</span>
          </div>
          <button type="button" className="admin-icon-button" onClick={onClose} aria-label="Close date inspector">
            <X aria-hidden="true" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-5 flex-1">
          {canManage && !onEditCapacity && <AdminNotice>Select one product in the planner before changing capacity or freezing intake.</AdminNotice>}
          {/* CAPACITY SUMMARY CARD */}
          <section className="card p-4 flex flex-col gap-3 bg-surface-muted/50 border border-line">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <span className="text-xs font-bold uppercase tracking-wider muted">Capacity Summary</span>
              <AdminStatusBadge
                status={soldOut ? "CANCELLED" : utilization >= 75 ? "CAPACITY_NEAR_LIMIT" : "CONFIRMED"}
                label={soldOut ? "Sold Out / Frozen" : utilization >= 75 ? "Near Limit" : "Open"}
              />
            </div>

            <div className="grid grid-cols-3 gap-2 text-center my-1">
              <div className="bg-surface p-2.5 rounded-xl border border-line">
                <span className="text-xs muted font-semibold uppercase block">Total</span>
                <span className="text-lg font-bold text-ink ops-tabular">{formatLitres(capacityMl)}</span>
              </div>
              <div className="bg-surface p-2.5 rounded-xl border border-line">
                <span className="text-xs muted font-semibold uppercase block">Reserved</span>
                <span className="text-lg font-bold text-primary ops-tabular">
                  {formatLitres(reservedMl)} ({utilization}%)
                </span>
              </div>
              <div className="bg-surface p-2.5 rounded-xl border border-line">
                <span className="text-xs muted font-semibold uppercase block">Remaining</span>
                <span className="text-lg font-bold text-emerald-700 ops-tabular">{formatLitres(remainingMl)}</span>
              </div>
            </div>

            <div className="availability-inspector-actions">
              {canManage && onEditCapacity && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={onEditCapacity}
                >
                  <Pencil aria-hidden="true" />Edit capacity
                </button>
              )}

              {canSoldOut && (
                <button
                  type="button"
                  className={`btn ${
                    soldOut ? "btn-secondary" : "btn-danger"
                  }`}
                  onClick={onFreeze}
                >
                  {soldOut ? <UnlockKeyhole aria-hidden="true" /> : <LockKeyhole aria-hidden="true" />}{soldOut ? "Reopen date" : "Freeze date"}
                </button>
              )}
            </div>

            {soldOutReason && (
              <div className="text-xs p-2.5 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 font-medium">
                Lock reason: <strong>{soldOutReason}</strong>
              </div>
            )}
          </section>

          {/* FULFILLMENT BREAKDOWN & REVENUE */}
          {ordersData && (
            <section className="card p-4 flex flex-col gap-3">
              <div className="border-b border-line pb-2">
                <span className="text-xs font-bold uppercase tracking-wider muted">Fulfillment Breakdown</span>
                <h4 className="text-sm font-bold text-ink mt-0.5">Pickup vs. Delivery Distribution</h4>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200">
                  <span className="font-bold text-emerald-900 flex items-center gap-1.5 text-sm"><MapPin aria-hidden="true" />Pickup</span>
                  <span className="text-emerald-800 font-semibold block mt-1">
                    {formatLitres(ordersData.pickupVolumeMl)} ({ordersData.pickupCount} orders)
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200">
                  <span className="font-bold text-blue-900 flex items-center gap-1.5 text-sm"><Truck aria-hidden="true" />Home delivery</span>
                  <span className="text-blue-800 font-semibold block mt-1">
                    {formatLitres(ordersData.deliveryVolumeMl)} ({ordersData.deliveryCount} orders)
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-surface-muted border border-line text-xs">
                <span className="font-semibold muted uppercase">Total Business Date Revenue</span>
                <strong className="text-base font-bold text-primary ops-tabular">
                  {formatAdminMoney(ordersData.totalRevenueCents)}
                </strong>
              </div>
            </section>
          )}

          {/* BOOKED ORDERS LIST */}
          <section className="card p-4 flex flex-col gap-3">
            <div className="border-b border-line pb-2 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider muted">CUSTOMER RESERVATIONS</span>
                <h4 className="text-sm font-bold text-ink">
                  Orders Booked ({ordersData?.orders.length ?? 0})
                </h4>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {(ordersData?.orders ?? []).map((order) => (
                <div
                  key={order.id}
                  className="p-3 rounded-xl border border-line bg-surface flex items-center justify-between gap-3 text-xs hover:border-muted transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <Link
                        className="font-bold text-primary hover:underline ops-tabular"
                        href={`/admin/orders/${order.id}`}
                      >
                        {order.publicReference}
                      </Link>
                      <AdminStatusBadge status={order.status} />
                    </div>
                    <span className="text-ink font-semibold block mt-0.5">{order.customerName}</span>
                    <span className="muted text-[11px] block">
                      {order.packageLabelFi} ({formatLitres(order.volumeMl)}) · {order.fulfillmentMethod === "PICKUP" ? "Pickup" : "Delivery"}
                    </span>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-bold text-ink block ops-tabular">{formatAdminMoney(order.priceCents)}</span>
                    <Link
                      className="text-[11px] font-semibold text-primary hover:underline"
                      href={`/admin/orders/${order.id}`}
                    >
                      View order
                    </Link>
                  </div>
                </div>
              ))}

              {(!ordersData || ordersData.orders.length === 0) && (
                <p className="text-xs muted text-center py-4">No customer orders booked for this date yet.</p>
              )}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}
