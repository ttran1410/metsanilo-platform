"use client";

import { Search } from "lucide-react";
import type { InputHTMLAttributes } from "react";

type AdminSearchFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  wrapperClassName?: string;
};

export function AdminSearchField({ wrapperClassName = "", className = "", "aria-label": ariaLabel, ...props }: AdminSearchFieldProps) {
  return (
    <label className={`admin-search-field ${wrapperClassName}`}>
      <Search aria-hidden="true" className="admin-search-field-icon" />
      <input {...props} type="search" aria-label={ariaLabel ?? props.placeholder ?? "Search"} className={`admin-search-field-input ${className}`} />
    </label>
  );
}
