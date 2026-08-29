export type MediaMetadataCommand = { attachmentId: string; altFi: FormDataEntryValue | null; altEn: FormDataEntryValue | null };
export type MediaReorderCommand = { attachmentId: string; attachmentIds: string[] };

async function requestMedia(path: string, init: RequestInit) {
  const response = await fetch(path, init);
  const body = await response.json().catch(() => ({})) as { data?: unknown; message?: string };
  if (!response.ok) throw new Error(body.message ?? "Media action failed.");
  return body.data;
}

export function updateMediaMetadata(command: MediaMetadataCommand) { return requestMedia(`/api/admin/media/${command.attachmentId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "metadata", altFi: command.altFi, altEn: command.altEn }) }); }
export function setPrimaryMedia(attachmentId: string) { return requestMedia(`/api/admin/media/${attachmentId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "primary" }) }); }
export function deleteMedia(attachmentId: string) { return requestMedia(`/api/admin/media/${attachmentId}`, { method: "DELETE" }); }
export function reorderMedia(command: MediaReorderCommand) { return requestMedia(`/api/admin/media/${command.attachmentId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "reorder", attachmentIds: command.attachmentIds }) }); }
export function uploadMedia(data: FormData) { return requestMedia("/api/admin/media", { method: "POST", body: data }); }
