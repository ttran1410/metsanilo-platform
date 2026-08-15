"use client";

import { useEffect, useState, type FormEvent } from "react";

type Method = { method: string; enabled: boolean };
type Contact = { phone: string; email: string; hours: string };

export function OperationsSettings() {
  const [methods, setMethods] = useState<Method[]>([]);
  const [contact, setContact] = useState<Contact>({ phone: "", email: "", hours: "" });
  const [message, setMessage] = useState("");
  async function load() {
    const response = await fetch("/api/admin/payment-methods");
    const body = await response.json();
    if (response.ok) setMethods(body.data);
    else setMessage(body.code ?? "Operational settings unavailable");
  }
  async function loadContact() { const response = await fetch("/api/admin/contact"); const body = await response.json(); if (response.ok) setContact(body.data); else setMessage(body.code ?? "Contact settings unavailable"); }
  useEffect(() => { const timer = window.setTimeout(() => { void load(); void loadContact(); }, 0); return () => window.clearTimeout(timer); }, []);
  async function toggle(method: Method) {
    const response = await fetch("/api/admin/payment-methods", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ method: method.method, enabled: !method.enabled }) });
    const body = await response.json();
    if (!response.ok) return setMessage(body.code ?? body.message ?? "Request failed");
    setMethods((rows) => rows.map((row) => row.method === method.method ? body.data : row));
    setMessage("Payment method updated.");
  }
  async function saveContact(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const values = new FormData(event.currentTarget); const response = await fetch("/api/admin/contact", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone: values.get("phone"), email: values.get("email"), hours: values.get("hours") }) }); const body = await response.json(); if (!response.ok) return setMessage(body.message ?? body.code ?? "Contact settings update failed"); setContact(body.data); setMessage("Contact settings updated."); }
  return <section className="shell pb-10"><div className="admin-page-header"><div><p className="eyebrow">ADMINISTRATION</p><h1>Operational settings</h1><p className="admin-page-lede">Enable payment methods and maintain the customer-facing contact details.</p></div></div>{message && <div className="admin-notice admin-notice-success" role="status">{message}</div>}<div className="card mt-3 grid gap-2 md:grid-cols-3">{methods.map((method) => <label className="flex items-center gap-2" key={method.method}><input type="checkbox" checked={method.enabled} onChange={() => void toggle(method)} />{method.method.replace("_", " ")}</label>)}</div><form className="card mt-3 grid gap-3 md:grid-cols-3" onSubmit={saveContact}><h3 className="font-bold md:col-span-3">Customer contact</h3><label className="field"><span>Phone</span><input name="phone" type="tel" value={contact.phone} onChange={(event) => setContact({ ...contact, phone: event.target.value })} placeholder="+358 44 951 2904" /></label><label className="field"><span>Email</span><input name="email" type="email" value={contact.email} onChange={(event) => setContact({ ...contact, email: event.target.value })} placeholder="contact@example.fi" /></label><label className="field"><span>Contact hours</span><input name="hours" value={contact.hours} onChange={(event) => setContact({ ...contact, hours: event.target.value })} placeholder="08:00–20:00 Mon–Fri" /></label><button className="btn md:col-span-3" type="submit">Save contact details</button></form></section>;
}
