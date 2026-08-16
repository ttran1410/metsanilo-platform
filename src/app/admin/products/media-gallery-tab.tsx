"use client";

import { useState, type DragEvent, type FormEvent } from "react";

type MediaAsset = {
  id: string;
  attachmentId?: string;
  url: string;
  altFi: string;
  altEn: string;
  isPrimary: boolean;
};

export function MediaGalleryTab({
  productId,
  mediaList,
  canMedia,
  onRefresh,
}: {
  productId: string;
  mediaList: MediaAsset[];
  canMedia: boolean;
  onRefresh: () => void;
}) {
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [altEditingId, setAltEditingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  async function setPrimary(image: MediaAsset) {
    if (!image.attachmentId) return;
    setError("");
    setNotice("");
    const response = await fetch(`/api/admin/media/${image.attachmentId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "primary" }),
    });
    if (!response.ok) return setError("Could not set primary hero image.");
    setNotice("Primary hero image updated.");
    onRefresh();
  }

  async function saveAlt(event: FormEvent<HTMLFormElement>, image: MediaAsset) {
    event.preventDefault();
    if (!image.attachmentId) return;
    setError("");
    setNotice("");
    const values = new FormData(event.currentTarget);
    const response = await fetch(`/api/admin/media/${image.attachmentId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "metadata",
        altFi: values.get("altFi"),
        altEn: values.get("altEn"),
      }),
    });
    const body = await response.json();
    if (!response.ok) return setError(body.message ?? "Could not save alt tags.");
    setAltEditingId(null);
    setNotice("Alt text tags updated.");
    onRefresh();
  }

  async function deleteMedia(attachmentId?: string) {
    if (!attachmentId) return;
    setError("");
    setNotice("");
    const response = await fetch(`/api/admin/media/${attachmentId}`, { method: "DELETE" });
    if (!response.ok) return setError("Could not delete image.");
    setNotice("Image removed.");
    onRefresh();
  }

  async function reorderMedia(ordered: MediaAsset[]) {
    setError("");
    const validIds = ordered.map((item) => item.attachmentId).filter((id): id is string => Boolean(id));
    if (!validIds.length) return;
    const response = await fetch(`/api/admin/media/${validIds[0]}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "reorder", attachmentIds: validIds }),
    });
    if (!response.ok) return setError("Could not reorder gallery.");
    setNotice("Gallery order updated.");
    onRefresh();
  }

  function shiftMedia(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= mediaList.length) return;
    const next = [...mediaList];
    const [moved] = next.splice(index, 1);
    next.splice(nextIndex, 0, moved);
    void reorderMedia(next);
  }

  function dropImage(event: DragEvent<HTMLElement>, target: MediaAsset) {
    event.preventDefault();
    if (!draggingId || draggingId === target.attachmentId) return;
    const next = [...mediaList];
    const from = next.findIndex((item) => item.attachmentId === draggingId);
    const to = next.findIndex((item) => item.attachmentId === target.attachmentId);
    if (from < 0 || to < 0) return;
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setDraggingId(null);
    void reorderMedia(next);
  }

  async function upload(event: FormEvent<HTMLFormElement>, droppedFile?: File) {
    event.preventDefault();
    setError("");
    setNotice("");
    const data = new FormData(event.currentTarget);
    const file = droppedFile ?? (data.get("file") as File | null);
    if (!file || !file.size) return setError("Choose an image file first.");
    data.set("file", file);
    data.set("productId", productId);
    const response = await fetch("/api/admin/media", { method: "POST", body: data });
    const body = await response.json();
    if (!response.ok) return setError(body.message ?? "Upload failed");
    setNotice("Image uploaded successfully.");
    onRefresh();
  }

  return (
    <div className="card p-4 md:p-5 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div>
          <span className="eyebrow">PRODUCT MEDIA ASSETS</span>
          <h3 className="text-base font-bold text-ink">Photo Gallery ({mediaList.length})</h3>
          <p className="text-xs muted">
            Drag cards or use arrow buttons to reorder. The first or primary hero photo appears on storefronts.
          </p>
        </div>
      </div>

      {error && <p className="text-xs font-semibold text-danger">{error}</p>}
      {notice && <p className="text-xs font-semibold text-emerald-700">{notice}</p>}

      {/* Thumbnail Gallery Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {mediaList.map((image, index) => (
          <div
            key={image.attachmentId ?? image.id}
            draggable={canMedia}
            onDragStart={() => setDraggingId(image.attachmentId ?? image.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => dropImage(e, image)}
            className={`relative rounded-xl overflow-hidden border bg-surface-muted flex flex-col group transition-shadow ${
              image.isPrimary ? "border-emerald-500 ring-2 ring-emerald-500/30 shadow-md" : "border-line"
            }`}
          >
            {/* Square Aspect Ratio Crop */}
            <div className="relative aspect-square w-full bg-surface-muted overflow-hidden">
              <img src={image.url} alt={image.altFi || "Product photo"} className="w-full h-full object-cover" />

              {image.isPrimary && (
                <span className="absolute top-2 left-2 text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-700 text-on-primary shadow-md">
                  ⭐ Primary Hero
                </span>
              )}

              {/* Shift Left/Right Controls */}
              {canMedia && mediaList.length > 1 && (
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-ink/80 p-0.5 rounded text-on-primary shadow">
                  <button
                    type="button"
                    className="px-1 text-xs hover:text-emerald-300 disabled:opacity-30"
                    disabled={index === 0}
                    onClick={() => shiftMedia(index, -1)}
                    title="Move left"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    className="px-1 text-xs hover:text-emerald-300 disabled:opacity-30"
                    disabled={index === mediaList.length - 1}
                    onClick={() => shiftMedia(index, 1)}
                    title="Move right"
                  >
                    →
                  </button>
                </div>
              )}
            </div>

            {/* Accessibility ALT Tags & Actions */}
            <div className="p-2.5 flex flex-col gap-1 text-xs bg-surface border-t border-line">
              <p className="font-medium truncate text-ink">{image.altFi || "No FI alt tag"}</p>
              <p className="text-[11px] muted truncate">{image.altEn || "No EN alt tag"}</p>

              {canMedia && (
                <div className="flex flex-wrap items-center justify-between gap-1 pt-1.5 border-t border-line/60 mt-1">
                  {!image.isPrimary && (
                    <button
                      type="button"
                      className="text-[11px] font-semibold text-primary hover:underline"
                      onClick={() => void setPrimary(image)}
                    >
                      Set Hero
                    </button>
                  )}
                  <button
                    type="button"
                    className="text-[11px] text-muted hover:text-ink"
                    onClick={() => setAltEditingId(altEditingId === image.attachmentId ? null : (image.attachmentId ?? null))}
                  >
                    ALT Tags
                  </button>
                  <button
                    type="button"
                    className="text-[11px] text-danger hover:underline"
                    onClick={() => void deleteMedia(image.attachmentId)}
                  >
                    Remove
                  </button>
                </div>
              )}

              {/* Inline ALT Text Form */}
              {altEditingId === image.attachmentId && (
                <form className="mt-2 flex flex-col gap-1.5" onSubmit={(e) => void saveAlt(e, image)}>
                  <input name="altFi" defaultValue={image.altFi} placeholder="Finnish ALT tag *" required className="text-xs p-1 border rounded" />
                  <input name="altEn" defaultValue={image.altEn} placeholder="English ALT tag *" required className="text-xs p-1 border rounded" />
                  <button className="btn text-xs py-1 px-2">Save ALT</button>
                </form>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Upload Dropzone */}
      {canMedia && (
        <form
          className="mt-3 border-2 border-dashed border-line hover:border-primary rounded-xl p-5 text-center bg-surface-muted/30 flex flex-col items-center gap-2 transition-colors cursor-pointer"
          onSubmit={(e) => void upload(e)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) void upload(e, file);
          }}
        >
          <span className="text-3xl">⬆️</span>
          <div>
            <strong className="text-sm text-ink block">Drag &amp; Drop New Images Here</strong>
            <span className="text-xs muted">Supports JPG, PNG, WebP (Max 5 MB)</span>
          </div>

          <input name="file" type="file" accept="image/jpeg,image/png,image/webp" required className="text-xs" />
          <div className="grid gap-2 sm:grid-cols-2 w-full max-w-md mt-1">
            <input name="altFi" placeholder="Finnish ALT tag *" required className="text-xs p-1.5 border rounded" />
            <input name="altEn" placeholder="English ALT tag *" required className="text-xs p-1.5 border rounded" />
          </div>

          <button className="btn text-xs py-1.5 px-4 mt-2" type="submit">
            Upload Image Asset
          </button>
        </form>
      )}
    </div>
  );
}
