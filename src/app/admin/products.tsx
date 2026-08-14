"use client";

import { useState, type FormEvent } from "react";
import type { packages, products } from "@/db/schema";

type ProductRow = { product: typeof products.$inferSelect; packages: Array<typeof packages.$inferSelect>; media?: Array<{ id: string; url: string; altFi: string; altEn: string; isPrimary: boolean }> };
const blank = { code: "", slug: "", nameFi: "", nameEn: "", descriptionFi: "", descriptionEn: "", availableFrom: "", availableThrough: "", active: true };

export function ProductModule({ initialProducts, canManageMedia }: { initialProducts: ProductRow[]; canManageMedia: boolean }) {
  const [rows, setRows] = useState(initialProducts); const [form, setForm] = useState(blank); const [message, setMessage] = useState("");
  function field(name: keyof typeof blank, value: string | boolean) { setForm((current) => ({ ...current, [name]: value })); }
  async function create(event: FormEvent) {
    event.preventDefault(); setMessage("");
    const response = await fetch("/api/admin/products", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...form, packages: [{ labelFi: "Peruspakkaus", labelEn: "Standard package", volumeMl: 1000, priceCents: 0, active: true }] }) });
    const body = await response.json(); if (!response.ok) return setMessage(body.message ?? body.code ?? "Request failed");
    setRows((current) => [...current, body.data]); setForm(blank); setMessage("Product created. Add packages through the API until package editor is enabled in the next UI slice.");
  }
  async function toggle(row: ProductRow) {
    const response = await fetch(`/api/admin/products/${row.product.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "active", active: !row.product.active }) });
    const body = await response.json(); if (!response.ok) return setMessage(body.message ?? body.code ?? "Request failed");
    setRows((current) => current.map((item) => item.product.id === row.product.id ? body.data : item)); setMessage("Product state updated.");
  }
  async function remove(row: ProductRow) {
    if (!window.confirm("Delete this product only if it is unreferenced?")) return;
    const response = await fetch(`/api/admin/products/${row.product.id}`, { method: "DELETE" }); const body = await response.json();
    if (!response.ok) return setMessage(body.message ?? body.code ?? "Product is in use");
    setRows((current) => current.filter((item) => item.product.id !== row.product.id)); setMessage("Product deleted.");
  }
  async function upload(row: ProductRow, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget); form.set("productId", row.product.id);
    const response = await fetch("/api/admin/media", { method: "POST", body: form }); const body = await response.json();
    if (!response.ok) return setMessage(body.message ?? "Image upload failed");
    setRows((current) => current.map((item) => item.product.id === row.product.id ? { ...item, media: [...(item.media ?? []), { id: body.data.id, url: body.data.url, altFi: body.data.altFi, altEn: body.data.altEn, isPrimary: (item.media ?? []).length === 0 }] } : item));
    event.currentTarget.reset(); setMessage("Image uploaded.");
  }
  async function removeMedia(row: ProductRow, mediaId: string) { if (!window.confirm("Remove this image?")) return; const response = await fetch(`/api/admin/media/${mediaId}`, { method: "DELETE" }); const body = await response.json(); if (!response.ok) return setMessage(body.message ?? "Image removal failed"); setRows((current) => current.map((item) => item.product.id === row.product.id ? { ...item, media: (item.media ?? []).filter((image) => image.id !== mediaId) } : item)); setMessage("Image removed."); }
  return <section className="mt-10"><h2 className="text-2xl font-bold">Products &amp; packages</h2>{message && <p className="card mt-3" role="status">{message}</p>}
    <form className="card mt-3 grid gap-3" onSubmit={create}><h3 className="font-bold">Create product</h3>
      <div className="grid gap-3 md:grid-cols-2"><label className="field"><span>Code</span><input required value={form.code} onChange={(e) => field("code", e.target.value)} placeholder="BERRIES" /></label><label className="field"><span>Slug</span><input required value={form.slug} onChange={(e) => field("slug", e.target.value)} placeholder="berries" /></label></div>
      <div className="grid gap-3 md:grid-cols-2"><label className="field"><span>Name (Finnish)</span><input required value={form.nameFi} onChange={(e) => field("nameFi", e.target.value)} /></label><label className="field"><span>Name (English)</span><input required value={form.nameEn} onChange={(e) => field("nameEn", e.target.value)} /></label></div>
      <div className="grid gap-3 md:grid-cols-2"><label className="field"><span>Description (Finnish)</span><textarea value={form.descriptionFi} onChange={(e) => field("descriptionFi", e.target.value)} maxLength={5000} /></label><label className="field"><span>Description (English)</span><textarea value={form.descriptionEn} onChange={(e) => field("descriptionEn", e.target.value)} maxLength={5000} /></label></div>
      <div className="grid gap-3 md:grid-cols-2"><label className="field"><span>Available from</span><input required type="date" value={form.availableFrom} onChange={(e) => field("availableFrom", e.target.value)} /></label><label className="field"><span>Available through</span><input required type="date" value={form.availableThrough} onChange={(e) => field("availableThrough", e.target.value)} /></label></div>
      <button className="btn w-fit" type="submit">Create product</button>
    </form>
    <div className="mt-3 grid gap-3">{rows.map((row) => <article className="card" key={row.product.id}><div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-bold">{row.product.nameFi} / {row.product.nameEn} <span className="pill">{row.product.active ? "Active" : "Archived"}</span></h3><p>{row.product.code} · {row.product.slug} · {row.product.availableFrom} – {row.product.availableThrough}</p><p className="mt-1 text-sm">{row.product.descriptionFi || "No Finnish description"}</p><p className="text-sm">Packages: {row.packages.length}</p></div><div className="flex gap-2"><button className="btn btn-secondary" onClick={() => void toggle(row)}>{row.product.active ? "Archive" : "Activate"}</button><button className="btn bg-[var(--berry)]" onClick={() => void remove(row)}>Delete</button></div></div>{canManageMedia && <div className="mt-4 border-t pt-4"><div className="flex items-center justify-between gap-2"><h4 className="font-bold">Product images <span className="text-sm font-normal text-slate-600">{row.media?.length ?? 0}/4</span></h4><span className="text-xs text-slate-600">JPEG, PNG or WebP · max 2 MB</span></div><div className="mt-2 flex flex-wrap gap-2">{(row.media ?? []).map((image) => <div className="relative" key={image.id}><img className="h-20 w-20 rounded-lg object-cover" src={image.url} alt={image.altFi} /><button className="absolute right-1 top-1 rounded bg-white px-1 text-sm" type="button" aria-label="Remove image" onClick={() => void removeMedia(row, image.id)}>×</button></div>)}</div>{(row.media?.length ?? 0) < 4 ? <form className="mt-3 grid gap-2 md:grid-cols-3" onSubmit={(event) => void upload(row, event)}><input name="file" type="file" accept="image/jpeg,image/png,image/webp" required aria-label="Product image" /><input name="altFi" required maxLength={160} placeholder="Alt text (Finnish)" aria-label="Finnish alt text" /><input name="altEn" required maxLength={160} placeholder="Alt text (English)" aria-label="English alt text" /><button className="btn w-fit" type="submit">Add image</button></form> : <p className="mt-2 text-sm text-slate-600">Maximum 4 images reached. Remove an image before adding another.</p>}</div>}</article>)}</div>
  </section>;
}
