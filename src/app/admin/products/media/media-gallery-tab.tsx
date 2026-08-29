"use client";

import Image from "next/image";
import { useState, type DragEvent } from "react";
import { useMediaGalleryController } from "./use-media-gallery-controller";
import type { AdminProductMedia } from "../types/media";

export function MediaGalleryTab({
  productId,
  mediaList,
  canMedia,
  onRefresh,
}: {
  productId: string;
  mediaList: AdminProductMedia[];
  canMedia: boolean;
  onRefresh: () => void;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const { error, notice, altEditingId, setAltEditingId, setPrimary, saveAlt, deleteMedia, reorderMedia, upload } = useMediaGalleryController({ productId, onRefresh });

  function shiftMedia(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= mediaList.length) return;
    const next = [...mediaList];
    const [moved] = next.splice(index, 1);
    next.splice(nextIndex, 0, moved);
    void reorderMedia(next);
  }

  function dropImage(event: DragEvent<HTMLElement>, target: AdminProductMedia) {
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
              <Image src={image.url} alt={image.altFi || "Product photo"} width={640} height={640} unoptimized className="w-full h-full object-cover" />

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
