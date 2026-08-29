"use client";

import { useEffect, type Dispatch, type SetStateAction } from "react";
import type { SeasonItem } from "./season-tracker";

type SeasonSummary = { availabilityDays: number; plannedVolumeMl: number; reservedVolumeMl: number; remainingVolumeMl: number; orderCount: number; orderedVolumeMl: number };

export function useSeasonQueryController({ productId, selectedSeasonId, setSeasons, setSummary, setSummaryLoading }: { productId?: string; selectedSeasonId: string | null; setSeasons: Dispatch<SetStateAction<SeasonItem[]>>; setSummary: Dispatch<SetStateAction<SeasonSummary | null>>; setSummaryLoading: (loading: boolean) => void }) {
  useEffect(() => {
    if (!productId) return;
    const controller = new AbortController();
    void fetch(`/api/admin/products/${productId}/seasons`, { signal: controller.signal, cache: "no-store", headers: { "x-admin-request-scope": "product-seasons" } })
      .then((response) => response.json())
      .then((body) => { if (!controller.signal.aborted && body.data) setSeasons(body.data); })
      .catch(() => undefined);
    return () => controller.abort();
  }, [productId, setSeasons]);

  useEffect(() => {
    if (!productId || !selectedSeasonId) return;
    const controller = new AbortController();
    setSummaryLoading(true);
    void fetch(`/api/admin/products/${productId}/seasons/${selectedSeasonId}`, { signal: controller.signal, cache: "no-store", headers: { "x-admin-request-scope": "season-summary" } })
      .then((response) => response.json())
      .then((body) => { if (!controller.signal.aborted) setSummary(body.data ?? null); })
      .catch((error) => { if (!(error instanceof DOMException && error.name === "AbortError")) setSummary(null); })
      .finally(() => { if (!controller.signal.aborted) setSummaryLoading(false); });
    return () => controller.abort();
  }, [productId, selectedSeasonId, setSummary, setSummaryLoading]);
}
