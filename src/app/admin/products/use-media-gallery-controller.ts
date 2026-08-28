"use client";

import { useState, type FormEvent } from "react";

type MediaAsset = { attachmentId?: string; };

export function useMediaGalleryController({ productId, onRefresh }: { productId: string; onRefresh: () => void }) {
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [altEditingId, setAltEditingId] = useState<string | null>(null);
  async function send(path: string, init: RequestInit, fallback: string, success: string) {
    setError(""); setNotice("");
    try { const response = await fetch(path, init); const body = await response.json().catch(() => ({})); if (!response.ok) return setError(body.message ?? fallback); setNotice(success); onRefresh(); }
    catch { setError(fallback); }
  }
  function setPrimary(image: MediaAsset) { if (image.attachmentId) void send(`/api/admin/media/${image.attachmentId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "primary" }) }, "Could not set primary hero image.", "Primary hero image updated."); }
  async function saveAlt(event: FormEvent<HTMLFormElement>, image: MediaAsset) { event.preventDefault(); if (!image.attachmentId) return; const values = new FormData(event.currentTarget); await send(`/api/admin/media/${image.attachmentId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "metadata", altFi: values.get("altFi"), altEn: values.get("altEn") }) }, "Could not save alt tags.", "Alt text tags updated."); setAltEditingId(null); }
  function deleteMedia(attachmentId?: string) { if (attachmentId) void send(`/api/admin/media/${attachmentId}`, { method: "DELETE" }, "Could not delete image.", "Image removed."); }
  function reorderMedia(ordered: MediaAsset[]) { const ids = ordered.map((item) => item.attachmentId).filter((id): id is string => Boolean(id)); if (ids.length) void send(`/api/admin/media/${ids[0]}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "reorder", attachmentIds: ids }) }, "Could not reorder gallery.", "Gallery order updated."); }
  async function upload(event: FormEvent<HTMLFormElement>, droppedFile?: File) { event.preventDefault(); const data = new FormData(event.currentTarget); const file = droppedFile ?? (data.get("file") as File | null); if (!file || !file.size) return setError("Choose an image file first."); data.set("file", file); data.set("productId", productId); await send("/api/admin/media", { method: "POST", body: data }, "Upload failed", "Image uploaded successfully."); }
  return { error, notice, altEditingId, setAltEditingId, setPrimary, saveAlt, deleteMedia, reorderMedia, upload };
}
