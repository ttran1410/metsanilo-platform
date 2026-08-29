"use client";

import { useState, type FormEvent } from "react";
import type { AdminProductMedia } from "../types/media";
import { deleteMedia as deleteMediaAction, reorderMedia as reorderMediaAction, setPrimaryMedia, updateMediaMetadata, uploadMedia } from "./media-admin-actions";

export function useMediaGalleryController({ productId, onRefresh }: { productId: string; onRefresh: () => void }) {
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [altEditingId, setAltEditingId] = useState<string | null>(null);
  async function send(action: () => Promise<unknown>, fallback: string, success: string) {
    setError(""); setNotice("");
    try { await action(); setNotice(success); onRefresh(); }
    catch (error) { setError(error instanceof Error ? error.message : fallback); }
  }
  function setPrimary(image: AdminProductMedia) { if (image.attachmentId) void send(() => setPrimaryMedia(image.attachmentId!), "Could not set primary hero image.", "Primary hero image updated."); }
  async function saveAlt(event: FormEvent<HTMLFormElement>, image: AdminProductMedia) { event.preventDefault(); if (!image.attachmentId) return; const values = new FormData(event.currentTarget); await send(() => updateMediaMetadata({ attachmentId: image.attachmentId!, altFi: values.get("altFi"), altEn: values.get("altEn") }), "Could not save alt tags.", "Alt text tags updated."); setAltEditingId(null); }
  function deleteMedia(attachmentId?: string) { if (attachmentId) void send(() => deleteMediaAction(attachmentId), "Could not delete image.", "Image removed."); }
  function reorderMedia(ordered: AdminProductMedia[]) { const ids = ordered.map((item) => item.attachmentId).filter((id): id is string => Boolean(id)); if (ids.length) void send(() => reorderMediaAction({ attachmentId: ids[0], attachmentIds: ids }), "Could not reorder gallery.", "Gallery order updated."); }
  async function upload(event: FormEvent<HTMLFormElement>, droppedFile?: File) { event.preventDefault(); const data = new FormData(event.currentTarget); const file = droppedFile ?? (data.get("file") as File | null); if (!file || !file.size) return setError("Choose an image file first."); data.set("file", file); data.set("productId", productId); await send(() => uploadMedia(data), "Upload failed", "Image uploaded successfully."); }
  return { error, notice, altEditingId, setAltEditingId, setPrimary, saveAlt, deleteMedia, reorderMedia, upload };
}
