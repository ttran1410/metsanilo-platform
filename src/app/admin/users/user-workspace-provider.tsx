"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { UserRoleFilter } from "./list/user-query-toolbar";

type UserWorkspaceContextValue = {
  selectedId: string;
  setSelectedId: (id: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  roleFilter: UserRoleFilter;
  setRoleFilter: (role: UserRoleFilter) => void;
  viewMode: "split" | "table";
  setViewMode: (mode: "split" | "table") => void;
  mobileView: "list" | "detail";
  setMobileView: (view: "list" | "detail") => void;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  splitLimit: number;
  setSplitLimit: (limit: number | ((previous: number) => number)) => void;
};

const UserWorkspaceContext = createContext<UserWorkspaceContextValue | null>(null);

export function UserWorkspaceProvider({
  initialSelectedId,
  initialSearchQuery,
  initialRoleFilter,
  children,
}: {
  initialSelectedId: string;
  initialSearchQuery: string;
  initialRoleFilter: UserRoleFilter;
  children: ReactNode;
}) {
  const [selectedId, setSelectedId] = useState(initialSelectedId);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [roleFilter, setRoleFilter] = useState(initialRoleFilter);
  const [viewMode, setViewMode] = useState<"split" | "table">("split");
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [splitLimit, setSplitLimit] = useState(20);

  return (
    <UserWorkspaceContext.Provider value={{ selectedId, setSelectedId, searchQuery, setSearchQuery, roleFilter, setRoleFilter, viewMode, setViewMode, mobileView, setMobileView, currentPage, setCurrentPage, pageSize, setPageSize, splitLimit, setSplitLimit }}>
      {children}
    </UserWorkspaceContext.Provider>
  );
}

export function useUserWorkspace() {
  const context = useContext(UserWorkspaceContext);
  if (!context) throw new Error("useUserWorkspace must be used within UserWorkspaceProvider");
  return context;
}
