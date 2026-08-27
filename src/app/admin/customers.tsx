"use client";

import { useEffect, useState } from "react";
import { AdminLoadingState } from "./presentation";
import { MasterDetailCustomerWorkspace, type CustomerRow } from "./customers/master-detail-workspace";

export function CustomersModule({
  canEdit,
  canAnonymize,
  canRetention,
}: {
  canEdit: boolean;
  canAnonymize: boolean;
  canRetention: boolean;
}) {
  const [initialCustomers, setInitialCustomers] = useState<CustomerRow[] | { items: CustomerRow[]; summary?: { totalCustomers: number; vipCount: number; totalLitres: number; consentCount: number } } | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/admin/customers");
        const body = await response.json();
        if (response.ok && body.data) {
          setInitialCustomers(body.data);
        } else {
          setInitialCustomers([]);
        }
      } catch {
        setInitialCustomers([]);
      }
    }
    void load();
  }, []);

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
