"use client";

import { CustomerQueryLoader } from "./customers/list/query-loader";

export function CustomersModule({
  canEdit,
  canAnonymize,
  canRetention,
}: {
  canEdit: boolean;
  canAnonymize: boolean;
  canRetention: boolean;
}) {
  return <CustomerQueryLoader canEdit={canEdit} canAnonymize={canAnonymize} canRetention={canRetention} />;
}
