"use client";

import { AdminSearchField } from "../ui/admin-search-field";

export type ProductFilterOption = {
  key: "all" | "in_season" | "upcoming" | "archived";
  label: string;
  count: number;
  tone: string;
};

export function ProductQueryToolbar({
  query,
  onQueryChange,
  filterStatus,
  onFilterChange,
  options,
}: {
  query: string;
  onQueryChange: (query: string) => void;
  filterStatus: ProductFilterOption["key"];
  onFilterChange: (status: ProductFilterOption["key"]) => void;
  options: ProductFilterOption[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 flex-1 max-w-lg">
      <AdminSearchField
        wrapperClassName="flex-1"
        placeholder="Search by name or code…"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        className="w-full text-xs py-1.5 px-3 rounded-lg border border-line bg-surface"
      />
      <div className="admin-catalog-filters text-[11px]">
        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            className={`px-2.5 py-1 rounded-md font-semibold whitespace-nowrap transition-colors ${
              filterStatus === option.key ? "bg-primary text-on-primary" : "bg-surface-muted text-ink/70 hover:bg-surface-muted/80"
            }`}
            onClick={() => onFilterChange(option.key)}
          >
            <span className={`admin-status-dot is-${option.tone}`} aria-hidden="true" />
            {option.label} <span className="admin-filter-count">{option.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
