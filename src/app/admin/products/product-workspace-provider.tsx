"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { ProductFilterOption } from "./product-query-toolbar";

type ProductWorkspaceContextValue = {
  selectedId: string;
  setSelectedId: (id: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filterStatus: ProductFilterOption["key"];
  setFilterStatus: (status: ProductFilterOption["key"]) => void;
  activeTab: "general" | "packages" | "media" | "channels";
  setActiveTab: (tab: ProductWorkspaceContextValue["activeTab"]) => void;
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

const ProductWorkspaceContext = createContext<ProductWorkspaceContextValue | null>(null);

export function ProductWorkspaceProvider({ initialSelectedId, initialSearchQuery, initialFilterStatus, initialActiveTab, initialViewMode, children }: {
  initialSelectedId: string;
  initialSearchQuery: string;
  initialFilterStatus: ProductFilterOption["key"];
  initialActiveTab: ProductWorkspaceContextValue["activeTab"];
  initialViewMode: "split" | "table";
  children: ReactNode;
}) {
  const [selectedId, setSelectedId] = useState(initialSelectedId);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [filterStatus, setFilterStatus] = useState(initialFilterStatus);
  const [activeTab, setActiveTab] = useState(initialActiveTab);
  const [viewMode, setViewMode] = useState(initialViewMode);
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [splitLimit, setSplitLimit] = useState(20);

  return <ProductWorkspaceContext.Provider value={{ selectedId, setSelectedId, searchQuery, setSearchQuery, filterStatus, setFilterStatus, activeTab, setActiveTab, viewMode, setViewMode, mobileView, setMobileView, currentPage, setCurrentPage, pageSize, setPageSize, splitLimit, setSplitLimit }}>{children}</ProductWorkspaceContext.Provider>;
}

export function useProductWorkspace() {
  const context = useContext(ProductWorkspaceContext);
  if (!context) throw new Error("useProductWorkspace must be used within ProductWorkspaceProvider");
  return context;
}
