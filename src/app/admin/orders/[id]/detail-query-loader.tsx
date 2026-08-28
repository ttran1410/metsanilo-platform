"use client";

import { useEffect, useState } from "react";
import { OrderDetailView } from "./view";

export function OrderDetailQueryLoader({ orderId, initialNotice, canDelete }: { orderId: string; initialNotice?: string; canDelete?: boolean }) {
  const [detail, setDetail] = useState<Parameters<typeof OrderDetailView>[0]["initial"] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/admin/orders/${orderId}`, { cache: "no-store", headers: { "x-admin-request-scope": "order-detail" } })
      .then((response) => response.ok ? response.json() : null)
      .then((body) => body?.data ? setDetail(body.data) : setError("Order not found."))
      .catch(() => setError("Could not load order."));
  }, [orderId]);

  if (error) return <p className="card" role="alert">{error}</p>;
  if (!detail) return <p className="card" role="status">Loading order...</p>;
  return <OrderDetailView initial={detail} initialNotice={initialNotice} canDelete={canDelete} />;
}
