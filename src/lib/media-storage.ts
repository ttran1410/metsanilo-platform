import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, put } from "@vercel/blob";

export type StoredMedia = { url: string; pathname: string };

function storageMode() {
  const configured = process.env.MEDIA_STORAGE;
  if (configured === "local" || configured === "blob") return configured;
  return process.env.NODE_ENV === "production" ? "blob" : "local";
}

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "file";
}

function localRoot() {
  return path.resolve(process.env.MEDIA_LOCAL_DIR || "public/uploads");
}

export async function storeMedia(input: { pathname: string; file: File }): Promise<StoredMedia> {
  if (storageMode() === "blob") {
    const blob = await put(input.pathname, input.file, { access: "public", addRandomSuffix: true, contentType: input.file.type });
    return { url: blob.url, pathname: blob.pathname };
  }

  const relativePath = input.pathname.split("/").map(safeSegment).join("/");
  const storedPath = `${relativePath.slice(0, relativePath.lastIndexOf("/") + 1)}${randomUUID()}-${safeSegment(path.basename(relativePath))}`;
  const absolutePath = path.join(localRoot(), storedPath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, Buffer.from(await input.file.arrayBuffer()));
  return { url: `/${path.posix.join("uploads", storedPath)}`, pathname: storedPath };
}

export async function removeMedia(media: { url: string; pathname: string }) {
  if (storageMode() === "blob") {
    await del(media.url);
    return;
  }

  if (!media.url.startsWith("/uploads/")) return;
  const relativePath = media.url.slice("/uploads/".length).split("/");
  if (relativePath.some((segment) => !segment || segment === "." || segment === "..")) return;
  await unlink(path.join(localRoot(), ...relativePath)).catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  });
}
