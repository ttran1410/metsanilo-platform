"use client";

import { useEffect, useState } from "react";
import { OrderEditForm, type AvailabilityItem, type Order, type Product } from "./order-edit-view";

export function OrderEditQueryLoader({ orderId }: { orderId: string }) {
  const [data, setData] = useState<{ detail: { order: Order }; products: Product[]; availabilityList: AvailabilityItem[] } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/admin/orders/${orderId}?view=edit`, { cache: "no-store", headers: { "x-admin-request-scope": "order-edit-detail" } })
      .then((response) => response.ok ? response.json() : null)
      .then((body) => body?.data ? setData(body.data) : setError("Order not found."))
      .catch(() => setError("Could not load order."));
  }, [orderId]);

  if (error) return <p className="card" role="alert">{error}</p>;
  if (!data) return <p className="card" role="status">Loading order...</p>;
  return <OrderEditForm initial={data.detail.order} products={data.products} availabilityList={data.availabilityList} />;
}
