"use client";

import { useEffect } from "react";

/**
 * Opens the native date picker when the user clicks anywhere on a date input,
 * not just the small calendar icon. Installed once per admin session via
 * AdminRouteFrame, so every current and future admin date input is covered.
 */
export function DatePickerBootstrap() {
  useEffect(() => {
    function openDatePicker(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      const input = target?.closest?.('input[type="date"]');
      if (!(input instanceof HTMLInputElement) || input.disabled || input.readOnly) return;
      try {
        input.showPicker();
      } catch {
        /* Picker unavailable (unsupported browser or blocked gesture): keep native behavior. */
      }
    }
    document.addEventListener("click", openDatePicker);
    return () => document.removeEventListener("click", openDatePicker);
  }, []);

  return null;
}
