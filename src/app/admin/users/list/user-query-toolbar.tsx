"use client";

import { AdminSearchField } from "../../ui/admin-search-field";

export type UserRoleFilter = "ALL" | "ADMIN" | "MANAGER" | "STAFF" | "CONTENT_CREATOR";

export function UserQueryToolbar({
  query,
  role,
  onQueryChange,
  onRoleChange,
}: {
  query: string;
  role: UserRoleFilter;
  onQueryChange: (query: string) => void;
  onRoleChange: (role: UserRoleFilter) => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-1 max-w-md">
      <AdminSearchField
        wrapperClassName="flex-1"
        placeholder="Search team"
        aria-label="Search team members"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        className="w-full text-xs py-1.5 px-3 rounded-lg border border-line bg-surface"
      />
      <select
        aria-label="Filter role"
        value={role}
        onChange={(event) => onRoleChange(event.target.value as UserRoleFilter)}
        className="text-xs py-1.5 px-2 rounded-lg border border-line bg-surface font-semibold"
      >
        <option value="ALL">All Roles</option>
        <option value="ADMIN">ADMIN</option>
        <option value="MANAGER">MANAGER</option>
        <option value="STAFF">STAFF</option>
        <option value="CONTENT_CREATOR">CONTENT_CREATOR</option>
      </select>
    </div>
  );
}
