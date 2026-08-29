"use client";

import { Plus } from "lucide-react";
import { AdminPageHeader } from "../../presentation";

export function CustomerWorkspaceHeader({ count, canEdit, onCreate }: { count: number; canEdit: boolean; onCreate: () => void }) {
  return (
    <div className="customers-page-heading">
      <AdminPageHeader eyebrow="Relationships" title="Customers" description={`${count} customer${count === 1 ? "" : "s"} · Search safely, inspect the relationship, then take the next action.`} />
      {canEdit && <button type="button" className="btn" onClick={onCreate}><Plus aria-hidden="true" />New customer</button>}
    </div>
  );
}
