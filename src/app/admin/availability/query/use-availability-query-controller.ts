"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AvailabilityWorkspace as AvailabilityData } from "@/domain/availability";

type ViewMode = "WEEK" | "MONTH" | "TABLE";
type AvailabilityQuery = AvailabilityData;

const queryCache = new Map<string, { startedAt: number; promise: Promise<{ ok: boolean; data?: AvailabilityQuery }> }>();

function fetchAvailabilityQuery(path: string) {
  const now = Date.now();
  const cached = queryCache.get(path);
  if (cached && now - cached.startedAt < 2_000) return cached.promise;
  const promise = fetch(path)
    .then(async (response) => {
      const body = await response.json();
      return { ok: response.ok, data: body.data as AvailabilityQuery | undefined };
    })
    .finally(() => {
      window.setTimeout(() => {
        const current = queryCache.get(path);
        if (current?.promise === promise) queryCache.delete(path);
      }, 2_000);
    });
  queryCache.set(path, { startedAt: now, promise });
  return promise;
}

function daysForView(viewMode: ViewMode, startDate: string) {
  if (viewMode === "WEEK") return 7;
  if (viewMode === "TABLE") return 30;
  const date = new Date(`${startDate}T12:00:00Z`);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
}

export function useAvailabilityQueryController({
  initialWorkspace,
  loadInitialFromApi,
  viewMode,
  currentStartDate,
  productFilter,
  seasonFilter,
  onError,
}: {
  initialWorkspace: AvailabilityQuery;
  loadInitialFromApi: boolean;
  viewMode: ViewMode;
  currentStartDate: string;
  productFilter: string;
  seasonFilter: string;
  onError: (message: string) => void;
}) {
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const requestIdRef = useRef(0);
  const initialLoadStartedRef = useRef(false);

  const fetchWorkspaceForDates = useCallback(async (start: string, days = daysForView(viewMode, start), requestedProductId = productFilter, requestedSeasonId = seasonFilter) => {
    const requestId = ++requestIdRef.current;
    setWorkspaceLoading(true);
    try {
      const query = new URLSearchParams({
        startDate: start,
        days: days.toString(),
        productId: requestedProductId,
        ...(requestedSeasonId !== "ALL" ? { seasonId: requestedSeasonId } : {}),
      });
      const result = await fetchAvailabilityQuery(`/api/admin/availability?${query}`);
      if (requestId !== requestIdRef.current) return;
      if (result.ok && result.data) setWorkspace(result.data);
    } catch {
      if (requestId === requestIdRef.current) onError("Could not refresh availability data.");
    } finally {
      if (requestId === requestIdRef.current) setWorkspaceLoading(false);
    }
  }, [onError, productFilter, seasonFilter, viewMode]);

  useEffect(() => {
    if (!loadInitialFromApi || initialLoadStartedRef.current) return;
    initialLoadStartedRef.current = true;
    queueMicrotask(() => void fetchWorkspaceForDates(currentStartDate));
  }, [currentStartDate, fetchWorkspaceForDates, loadInitialFromApi]);

  return { workspace, workspaceLoading, fetchWorkspaceForDates };
}
