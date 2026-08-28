"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AdminLoadingState } from "./presentation";
import { MasterDetailCustomerWorkspace, type CustomerRow } from "./customers/master-detail-workspace";
import { getAdminQuery } from "./admin-query-cache";

export function CustomersModule({
  canEdit,
  canAnonymize,
  canRetention,
}: {
  canEdit: boolean;
  canAnonymize: boolean;
  canRetention: boolean;
}) {
  const searchParams = useSearchParams();
  const requestRef = useRef<AbortController | null>(null);
  const [initialCustomers, setInitialCustomers] = useState<CustomerRow[] | { items: CustomerRow[]; summary?: { totalCustomers: number; vipCount: number; totalLitres: number; consentCount: number } } | null>(null);

  useEffect(() => {
    async function load() {
      requestRef.current?.abort();
      const controller = new AbortController();
      try {
        const params = new URLSearchParams();
        for (const key of ["q", "filter", "sort", "page", "limit"]) {
          const value = searchParams.get(key);
          if (value) params.set(key, value);
        }
        const data = await getAdminQuery<CustomerRow[] | { items: CustomerRow[]; summary?: { totalCustomers: number; vipCount: number; totalLitres: number; consentCount: number } }>(`/api/admin/customers?${params.toString()}`, "customers-list");
        if (data) {
          setInitialCustomers(data);
        } else {
          setInitialCustomers([]);
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setInitialCustomers([]);
      }
    }
    void load();
    return () => requestRef.current?.abort();
  }, [searchParams]);

  if (!initialCustomers) {
    return (
      <section className="shell py-8">
        <AdminLoadingState label="Loading Customer 360 Workspace…" />
      </section>
    );
  }

  return (
    <MasterDetailCustomerWorkspace
      initialCustomers={initialCustomers}
      canEdit={canEdit}
      canAnonymize={canAnonymize}
      canRetention={canRetention}
    />
  );
}
