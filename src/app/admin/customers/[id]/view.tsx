"use client";

import { useState } from "react";

type Profile = { customer: { id: string; name: string; mobile: string; email: string | null; matchStatus: string; notes: string | null; updatedAt: string }; orders: Array<{ id: string; publicReference: string; status: string; fulfillmentDate: string; fulfillmentMethod: string; volumeMl: number; finalTotalCents: number | null; createdAt: string }>; audit: Array<{ id: string; action: string; actor: string; createdAt: string }> };
const money = (cents: number | null) => cents === null ? "—" : new Intl.NumberFormat("fi-FI", { style: "currency", currency: "EUR" }).format(cents / 100);
const date = (value: string) => new Intl.DateTimeFormat("fi-FI", { dateStyle: "medium" }).format(new Date(value));

export function CustomerProfileView({ initial }: { initial: Profile }) {
  const [profile, setProfile] = useState(initial); const [message, setMessage] = useState("");
  async function edit() {
    const name = window.prompt("Customer name", profile.customer.name)?.trim(); const mobile = window.prompt("Mobile number", profile.customer.mobile)?.trim();
    if (!name || !mobile) return; const email = window.prompt("Email (optional)", profile.customer.email ?? "")?.trim() ?? "";
    const response = await fetch(`/api/admin/customers/${profile.customer.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, mobile, email }) }); const body = await response.json();
    if (!response.ok) return setMessage(body.message ?? "Customer update failed"); setProfile((current) => ({ ...current, customer: { ...current.customer, ...body.data } })); setMessage("Customer updated.");
  }
  async function anonymize() {
    if (!window.confirm(`Anonymize ${profile.customer.name}? This removes personal contact details.`)) return;
    const response = await fetch(`/api/admin/customers/${profile.customer.id}`, { method: "POST" }); const body = await response.json(); if (!response.ok) return setMessage(body.message ?? "Anonymization failed");
    setProfile((current) => ({ ...current, customer: { ...current.customer, name: "Anonymized customer", mobile: "ANONYMIZED", email: null } })); setMessage("Customer anonymized.");
  }
  return <div className="customer-profile-layout">{message && <p className="card customer-profile-message" role="status">{message}</p>}<section className="card customer-profile-card"><div className="profile-card-heading"><div className="profile-avatar-large">{profile.customer.name.slice(0, 1).toUpperCase()}</div><div><p className="eyebrow">Contact details</p><h2>{profile.customer.name}</h2><p>{profile.customer.mobile}{profile.customer.email ? ` · ${profile.customer.email}` : ""}</p></div><span className="pill">{profile.customer.matchStatus}</span></div>{profile.customer.notes && <p className="profile-muted">{profile.customer.notes}</p>}<div className="profile-actions"><button className="btn" type="button" onClick={() => void edit()}>Edit details</button><button className="btn btn-secondary" type="button" onClick={() => void anonymize()}>Anonymize</button></div></section><section className="card customer-profile-card"><div className="section-inline-heading"><div><p className="eyebrow">History</p><h2>Orders</h2></div><span className="pill">{profile.orders.length} records</span></div><div className="customer-history-list">{profile.orders.length === 0 && <p className="profile-muted">No orders recorded.</p>}{profile.orders.map((order) => <a className="customer-history-row" href={`/admin/orders/${order.id}`} key={order.id}><div><strong>{order.publicReference}</strong><p>{date(order.createdAt)} · {order.fulfillmentMethod} · {order.volumeMl / 1000} L</p></div><div><span className="pill">{order.status}</span><p>{money(order.finalTotalCents)}</p></div></a>)}</div></section><section className="card customer-profile-card"><div className="section-inline-heading"><div><p className="eyebrow">Privacy &amp; activity</p><h2>Audit trail</h2></div></div><div className="customer-audit-list">{profile.audit.length === 0 && <p className="profile-muted">No customer changes recorded.</p>}{profile.audit.map((event) => <div className="customer-audit-row" key={event.id}><strong>{event.action.replace("customer.", "")}</strong><span>{event.actor} · {date(event.createdAt)}</span></div>)}</div></section></div>;
}
