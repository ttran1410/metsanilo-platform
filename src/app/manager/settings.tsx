"use client";

import { useEffect, useState } from "react";

type Method = { method: string; enabled: boolean };

export function OperationsSettings() {
  const [methods, setMethods] = useState<Method[]>([]);
  const [message, setMessage] = useState("");
  async function load() {
    const response = await fetch("/api/manager/payment-methods");
    const body = await response.json();
    if (response.ok) setMethods(body.data);
    else setMessage(body.code ?? "Operational settings unavailable");
  }
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, []);
  async function toggle(method: Method) {
    const response = await fetch("/api/manager/payment-methods", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ method: method.method, enabled: !method.enabled }) });
    const body = await response.json();
    if (!response.ok) return setMessage(body.code ?? body.message ?? "Request failed");
    setMethods((rows) => rows.map((row) => row.method === method.method ? body.data : row));
    setMessage("Payment method updated.");
  }
  return <section className="shell pb-10"><h2 className="text-2xl font-bold">Operational settings</h2><p className="mt-1 text-sm">Enable the payment methods your shop accepts. At least one must remain enabled.</p>{message && <p className="card mt-3" role="status">{message}</p>}<div className="card mt-3 grid gap-2 md:grid-cols-3">{methods.map((method) => <label className="flex items-center gap-2" key={method.method}><input type="checkbox" checked={method.enabled} onChange={() => void toggle(method)} />{method.method.replace("_", " ")}</label>)}</div></section>;
}
