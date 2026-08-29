"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AdminLoadingState } from "../../presentation";
import { CustomersWorkspace, type CustomerRow } from "../customers-workspace";
import { getAdminQuery } from "../../shared/query-cache";

export function CustomerQueryLoader({ canEdit, canAnonymize, canRetention }: { canEdit: boolean; canAnonymize: boolean; canRetention: boolean }) {
  const searchParams = useSearchParams();
  const [initialCustomers, setInitialCustomers] = useState<CustomerRow[] | { items: CustomerRow[]; summary?: { totalCustomers: number; vipCount: number; totalLitres: number; consentCount: number } } | null>(null);
  useEffect(() => {
    async function load() {
      const params = new URLSearchParams();
      for (const key of ["q", "filter", "sort", "page", "limit"]) { const value = searchParams.get(key); if (value) params.set(key, value); }
      const data = await getAdminQuery<CustomerRow[] | { items: CustomerRow[]; summary?: { totalCustomers: number; vipCount: number; totalLitres: number; consentCount: number } }>(`/api/admin/customers?${params.toString()}`, "customers-list");
      setInitialCustomers(data ?? []);
    }
    void load();
  }, [searchParams]);
  if (!initialCustomers) return <section className="shell py-8"><AdminLoadingState label="Loading Customer 360 Workspace…" /></section>;
  return <CustomersWorkspace initialCustomers={initialCustomers} canEdit={canEdit} canAnonymize={canAnonymize} canRetention={canRetention} />;
}
