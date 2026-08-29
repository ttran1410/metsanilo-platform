import { useEffect, useRef, useState } from "react";
import type { CustomerProfile } from "../types/customer-profile";

export function useCustomerProfileQuery({ onSelect, onShowDetail, onError, onProfileLoaded }: {
  onSelect: (id: string) => void;
  onShowDetail: () => void;
  onError: (message: string) => void;
  onProfileLoaded?: (profile: CustomerProfile) => void;
}) {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const requestRef = useRef<AbortController | null>(null);

  async function loadProfile(id: string, showDetail = true) {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    onSelect(id);
    if (showDetail) onShowDetail();
    setLoadingProfile(true);
    onError("");
    try {
      const response = await fetch(`/api/admin/customers/${id}`, { cache: "no-store", signal: controller.signal, headers: { "x-admin-request-scope": "customer-detail" } });
      const body = await response.json();
      if (controller.signal.aborted) return;
      setLoadingProfile(false);
      if (response.ok && body.data) {
        setProfile(body.data);
        onProfileLoaded?.(body.data);
      }
      else onError(body.message ?? "Could not load customer profile.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadingProfile(false);
      onError("Network error while loading profile.");
    }
  }

  useEffect(() => () => requestRef.current?.abort(), []);
  return { profile, setProfile, loadingProfile, loadProfile };
}
