"use client";

export function useProductMediaActionController({ onError }: { onError: (message: string) => void }) {
  async function request(path: string, init: RequestInit, fallback: string) {
    try {
      const response = await fetch(path, init);
      const body = await response.json().catch(() => ({})) as { data?: { altFi?: string; altEn?: string }; message?: string };
      if (!response.ok) { onError(body.message ?? fallback); return { ok: false, body }; }
      return { ok: true, body };
    } catch { onError("An unexpected network error occurred."); return { ok: false, body: {} }; }
  }
  return {
    saveMetadata: (id: string, altFi: FormDataEntryValue | null, altEn: FormDataEntryValue | null) => request(`/api/admin/media/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "metadata", altFi, altEn }) }, "Could not save alt text."),
    setPrimary: (id: string) => request(`/api/admin/media/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "primary" }) }, "Could not set primary image."),
    remove: (id: string) => request(`/api/admin/media/${id}`, { method: "DELETE" }, "Could not delete image."),
    reorder: (id: string, attachmentIds: string[]) => request(`/api/admin/media/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "reorder", attachmentIds }) }, "Could not reorder gallery."),
    upload: (data: FormData) => request("/api/admin/media", { method: "POST", body: data }, "Upload failed"),
  };
}
