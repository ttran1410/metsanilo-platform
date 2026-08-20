"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import type { ReviewItem } from "./edit-review-modal";

type OrderItem = {
  id: string;
  publicReference: string;
  customerName: string;
  mobile: string | null;
  email: string | null;
  status: string;
};

type CustomerItem = {
  id: string;
  name: string;
  mobile: string | null;
  email: string | null;
  facebookProfile: string | null;
};

export function LinkIdentityModal({
  review,
  onClose,
  onLinked,
}: {
  review: {
    id: string;
    displayName: string;
    contact: string | null;
    orderId: string | null;
  };
  onClose: () => void;
  onLinked: (updated: ReviewItem) => void;
}) {
  const [query, setQuery] = useState(review.contact || review.displayName || "");
  const [ordersList, setOrdersList] = useState<OrderItem[]>([]);
  const [customersList, setCustomersList] = useState<CustomerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function searchEntities() {
      if (!query.trim()) return;
      setLoading(true);
      setError("");
      try {
        const [ordersRes, custRes] = await Promise.all([
          fetch("/api/admin/orders", { cache: "no-store" }),
          fetch("/api/admin/customers", { cache: "no-store" }),
        ]);

        const ordersBody = await ordersRes.json();
        const custBody = await custRes.json();

        const q = query.trim().toLowerCase();

        if (ordersRes.ok && ordersBody.data) {
          const matched = (ordersBody.data as OrderItem[]).filter((o) =>
            `${o.publicReference} ${o.customerName} ${o.mobile ?? ""} ${o.email ?? ""}`.toLowerCase().includes(q)
          );
          setOrdersList(matched.slice(0, 5));
        }

        if (custRes.ok && custBody.data?.items) {
          const matched = (custBody.data.items as CustomerItem[]).filter((c) =>
            `${c.name} ${c.mobile ?? ""} ${c.email ?? ""} ${c.facebookProfile ?? ""}`.toLowerCase().includes(q)
          );
          setCustomersList(matched.slice(0, 5));
        }
      } catch {
        setError("Failed to fetch matching records.");
      } finally {
        setLoading(false);
      }
    }

    const timer = setTimeout(() => void searchEntities(), 300);
    return () => clearTimeout(timer);
  }, [query]);

  async function handleLink(target: { orderId?: string; customerId?: string }) {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/admin/reviews", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: review.id,
          action: "link_identity",
          orderId: target.orderId,
          customerId: target.customerId,
          verifiedBuyer: true,
        }),
      });

      const body = await res.json();
      setSubmitting(false);

      if (!res.ok) {
        return setError(body.message ?? "Link failed");
      }

      onLinked(body.data);
      onClose();
    } catch {
      setSubmitting(false);
      setError("Network error linking identity.");
    }
  }

  return (
    <div
      className="admin-command-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="card p-5 max-w-lg w-full bg-surface shadow-2xl rounded-2xl flex flex-col gap-4 max-h-[85vh] overflow-y-auto text-xs">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div>
            <span className="eyebrow text-primary">CRM IDENTITY RESOLVER</span>
            <h3 className="text-base font-bold text-ink">Link Reviewer to Order / Customer</h3>
          </div>
          <button type="button" className="text-muted hover:text-ink text-xl font-bold p-1" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="p-3 bg-surface-muted rounded-xl border border-line flex flex-col gap-1">
          <div className="flex items-center justify-between font-bold text-ink">
            <span>Reviewer: {review.displayName}</span>
            {review.contact && <span className="text-primary font-mono">{review.contact}</span>}
          </div>
          <p className="text-[11px] muted">
            Search orders or customer profiles by Order Ref (#R-xxx / #H-xxx), Name, Phone, Email, or Facebook.
          </p>
        </div>

        {error && <p className="text-xs font-bold text-rose-800 bg-rose-50 p-2.5 rounded-lg border border-rose-200">{error}</p>}

        <div className="relative">
          <input
            type="text"
            placeholder="Search order ref, customer name, phone, or Facebook profile…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full text-xs py-2 px-3 pl-9 rounded-xl border border-line bg-surface font-semibold"
          />
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted pointer-events-none" />
        </div>

        {loading && <p className="text-xs muted italic py-2 text-center">Searching matching orders &amp; CRM records...</p>}

        {/* MATCHING ORDERS */}
        <div className="flex flex-col gap-2">
          <span className="eyebrow text-[10px] text-emerald-900 font-bold">🛒 MATCHING DIGITAL ORDERS ({ordersList.length})</span>
          {ordersList.map((ord) => (
            <div
              key={ord.id}
              className="p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 flex items-center justify-between gap-2 hover:bg-emerald-100/60 transition-colors"
            >
              <div>
                <strong className="text-emerald-950 font-bold font-mono">{ord.publicReference}</strong>
                <span className="block text-ink text-[11px] font-semibold">{ord.customerName}</span>
                <span className="muted text-[10px]">{ord.mobile ?? ord.email ?? "No contact"}</span>
              </div>
              <button
                type="button"
                className="btn btn-secondary text-xs py-1 px-3 font-bold text-emerald-900 border-emerald-300 bg-white"
                disabled={submitting}
                onClick={() => void handleLink({ orderId: ord.id })}
              >
                🔗 Link Order
              </button>
            </div>
          ))}

          {!loading && ordersList.length === 0 && (
            <p className="text-[11px] muted italic px-2">No matching digital orders found.</p>
          )}
        </div>

        {/* MATCHING CUSTOMERS */}
        <div className="flex flex-col gap-2 pt-2 border-t border-line">
          <span className="eyebrow text-[10px] text-blue-900 font-bold">👤 MATCHING CRM CUSTOMERS ({customersList.length})</span>
          {customersList.map((cust) => (
            <div
              key={cust.id}
              className="p-2.5 rounded-xl border border-blue-200 bg-blue-50/50 flex items-center justify-between gap-2 hover:bg-blue-100/60 transition-colors"
            >
              <div>
                <strong className="text-blue-950 font-bold text-xs">{cust.name}</strong>
                <span className="block text-[11px] muted font-mono">{cust.mobile ?? cust.email ?? cust.facebookProfile ?? "No contact"}</span>
              </div>
              <button
                type="button"
                className="btn btn-secondary text-xs py-1 px-3 font-bold text-blue-900 border-blue-300 bg-white"
                disabled={submitting}
                onClick={() => void handleLink({ customerId: cust.id })}
              >
                👤 Link Customer
              </button>
            </div>
          ))}

          {!loading && customersList.length === 0 && (
            <p className="text-[11px] muted italic px-2">No matching customer profiles found in CRM.</p>
          )}
        </div>

        <div className="flex items-center justify-end pt-2 border-t border-line">
          <button type="button" className="btn btn-secondary text-xs py-1 px-4 font-bold" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
