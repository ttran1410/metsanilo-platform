"use client";

import { useState, type FormEvent } from "react";
import type { packages, products } from "@/db/schema";

type ProductRow = { product: typeof products.$inferSelect; packages: Array<typeof packages.$inferSelect> };
const blank = { code: "", slug: "", nameFi: "", nameEn: "", descriptionFi: "", descriptionEn: "", availableFrom: "", availableThrough: "", active: true };

export function ProductModule({ initialProducts }: { initialProducts: ProductRow[] }) {
  const [rows, setRows] = useState(initialProducts); const [form, setForm] = useState(blank); const [message, setMessage] = useState("");
  function field(name: keyof typeof blank, value: string | boolean) { setForm((current) => ({ ...current, [name]: value })); }
  async function create(event: FormEvent) {
    event.preventDefault(); setMessage("");
    const response = await fetch("/api/manager/products", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...form, packages: [{ labelFi: "Peruspakkaus", labelEn: "Standard package", volumeMl: 1000, priceCents: 0, active: true }] }) });
    const body = await response.json(); if (!response.ok) return setMessage(body.message ?? body.code ?? "Request failed");
    setRows((current) => [...current, body.data]); setForm(blank); setMessage("Product created. Add packages through the API until package editor is enabled in the next UI slice.");
  }
  async function toggle(row: ProductRow) {
    const response = await fetch(`/api/manager/products/${row.product.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "active", active: !row.product.active }) });
    const body = await response.json(); if (!response.ok) return setMessage(body.message ?? body.code ?? "Request failed");
    setRows((current) => current.map((item) => item.product.id === row.product.id ? body.data : item)); setMessage("Product state updated.");
  }
  async function remove(row: ProductRow) {
    if (!window.confirm("Delete this product only if it is unreferenced?")) return;
    const response = await fetch(`/api/manager/products/${row.product.id}`, { method: "DELETE" }); const body = await response.json();
    if (!response.ok) return setMessage(body.message ?? body.code ?? "Product is in use");
    setRows((current) => current.filter((item) => item.product.id !== row.product.id)); setMessage("Product deleted.");
  }
  return <section className="mt-10"><h2 className="text-2xl font-bold">Products &amp; packages</h2>{message && <p className="card mt-3" role="status">{message}</p>}
    <form className="card mt-3 grid gap-3" onSubmit={create}><h3 className="font-bold">Create product</h3>
      <div className="grid gap-3 md:grid-cols-2"><label className="field"><span>Code</span><input required value={form.code} onChange={(e) => field("code", e.target.value)} placeholder="BERRIES" /></label><label className="field"><span>Slug</span><input required value={form.slug} onChange={(e) => field("slug", e.target.value)} placeholder="berries" /></label></div>
      <div className="grid gap-3 md:grid-cols-2"><label className="field"><span>Name (Finnish)</span><input required value={form.nameFi} onChange={(e) => field("nameFi", e.target.value)} /></label><label className="field"><span>Name (English)</span><input required value={form.nameEn} onChange={(e) => field("nameEn", e.target.value)} /></label></div>
      <div className="grid gap-3 md:grid-cols-2"><label className="field"><span>Description (Finnish)</span><textarea value={form.descriptionFi} onChange={(e) => field("descriptionFi", e.target.value)} maxLength={5000} /></label><label className="field"><span>Description (English)</span><textarea value={form.descriptionEn} onChange={(e) => field("descriptionEn", e.target.value)} maxLength={5000} /></label></div>
      <div className="grid gap-3 md:grid-cols-2"><label className="field"><span>Available from</span><input required type="date" value={form.availableFrom} onChange={(e) => field("availableFrom", e.target.value)} /></label><label className="field"><span>Available through</span><input required type="date" value={form.availableThrough} onChange={(e) => field("availableThrough", e.target.value)} /></label></div>
      <button className="btn w-fit" type="submit">Create product</button>
    </form>
    <div className="mt-3 grid gap-3">{rows.map((row) => <article className="card" key={row.product.id}><div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-bold">{row.product.nameFi} / {row.product.nameEn} <span className="pill">{row.product.active ? "Active" : "Archived"}</span></h3><p>{row.product.code} · {row.product.slug} · {row.product.availableFrom} – {row.product.availableThrough}</p><p className="mt-1 text-sm">{row.product.descriptionFi || "No Finnish description"}</p><p className="text-sm">Packages: {row.packages.length}</p></div><div className="flex gap-2"><button className="btn btn-secondary" onClick={() => void toggle(row)}>{row.product.active ? "Archive" : "Activate"}</button><button className="btn bg-[var(--berry)]" onClick={() => void remove(row)}>Delete</button></div></div></article>)}</div>
  </section>;
}
