"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { AdminNotice, AdminPageHeader } from "./presentation";

type Method = {
  id?: string;
  method: string;
  enabled: boolean;
  instructionsFi?: string | null;
  instructionsEn?: string | null;
  merchantDetailsJson?: string | null;
};

type ShopIdentity = {
  nameFi: string;
  nameEn: string;
  businessName: string;
  businessId: string;
  phone: string;
  email: string;
  hours: string;
  howItWorksVisible: boolean;
  aboutUsVisible: boolean;
  reviewsVisible: boolean;
  active: boolean;
  logoUrl?: string | null;
  faviconUrl?: string | null;
};

type Source = {
  id: string;
  key: string;
  labelFi: string;
  labelEn: string;
  active: boolean;
  sortOrder: number;
};

type Location = {
  id: string;
  type: "PICKUP" | "DELIVERY_ORIGIN";
  nameFi: string;
  nameEn: string;
  address: string;
  instructionsFi: string;
  instructionsEn: string;
  active: boolean;
  isDefault: boolean;
};

type MediaItem = {
  id: string;
  url: string;
  altFi: string;
  altEn: string;
  attachmentId?: string;
};

type Section = "identity" | "fulfillment" | "payments" | "channels" | "storefront" | "danger";

export function OperationsSettings({ canManageSettings }: { canManageSettings: boolean }) {
  const [activeSection, setActiveSection] = useState<Section>("identity");

  const [shopData, setShopData] = useState<ShopIdentity>({
    nameFi: "",
    nameEn: "",
    businessName: "",
    businessId: "",
    phone: "",
    email: "",
    hours: "",
    howItWorksVisible: true,
    aboutUsVisible: true,
    reviewsVisible: true,
    active: true,
    logoUrl: null,
    faviconUrl: null,
  });

  const [methods, setMethods] = useState<Method[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  // Page Media Assets
  const [logoMedia, setLogoMedia] = useState<MediaItem[]>([]);
  const [faviconMedia, setFaviconMedia] = useState<MediaItem[]>([]);
  const [heroMedia, setHeroMedia] = useState<MediaItem[]>([]);
  const [howMedia, setHowMedia] = useState<MediaItem[]>([]);
  const [aboutMedia, setAboutMedia] = useState<MediaItem[]>([]);

  const [isDirty, setIsDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"success" | "error">("success");
  const [uploadingPageKey, setUploadingPageKey] = useState<string | null>(null);

  const feedback = (text: string, nextTone: "success" | "error") => {
    setMessage(text);
    setTone(nextTone);
  };

  async function request(url: string, options?: RequestInit) {
    const response = await fetch(url, options);
    const body = await response.json();
    if (!response.ok) throw new Error(body.message ?? body.code ?? "Request failed");
    return body.data;
  }

  async function loadPageMedia(pageKey: string, setter: (items: MediaItem[]) => void) {
    try {
      const items = await request(`/api/admin/media?pageKey=${pageKey}`);
      setter(items);
    } catch {
      setter([]);
    }
  }

  async function loadAll() {
    try {
      const [methodsData, contactData, sourceData, locationData] = await Promise.all([
        request("/api/admin/payment-methods"),
        request("/api/admin/contact"),
        request("/api/admin/order-sources"),
        request("/api/admin/fulfillment-locations"),
      ]);

      setMethods(methodsData);
      setShopData(contactData);
      setSources(sourceData);
      setLocations(locationData);

      void loadPageMedia("logo", setLogoMedia);
      void loadPageMedia("favicon", setFaviconMedia);
      void loadPageMedia("hero", setHeroMedia);
      void loadPageMedia("how-it-works", setHowMedia);
      void loadPageMedia("about-us", setAboutMedia);

      setIsDirty(false);
    } catch (error) {
      feedback(error instanceof Error ? error.message : "Settings unavailable", "error");
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  // Save Shop Identity & Contact
  async function saveShopIdentity(event?: FormEvent) {
    if (event) event.preventDefault();
    try {
      const updated = await request("/api/admin/contact", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(shopData),
      });
      setShopData(updated);
      setIsDirty(false);
      feedback("Shop identity & settings saved.", "success");
    } catch (error) {
      feedback(error instanceof Error ? error.message : "Update failed", "error");
    }
  }

  // Payment Method Updates
  async function savePaymentMethod(method: Method) {
    try {
      const data = await request("/api/admin/payment-methods", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(method),
      });
      setMethods((rows) => rows.map((row) => (row.method === method.method ? data : row)));
      setIsDirty(false);
      feedback(`Payment method ${method.method} updated.`, "success");
    } catch (error) {
      feedback(error instanceof Error ? error.message : "Update failed", "error");
    }
  }

  // Fulfillment Location Updates
  async function saveLocation(event: FormEvent<HTMLFormElement>, location: Location) {
    event.preventDefault();
    try {
      const values = new FormData(event.currentTarget);
      const data = await request("/api/admin/fulfillment-locations", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: location.id,
          type: values.get("type"),
          nameFi: values.get("nameFi"),
          nameEn: values.get("nameEn"),
          address: values.get("address"),
          instructionsFi: values.get("instructionsFi"),
          instructionsEn: values.get("instructionsEn"),
          active: values.get("active") === "on",
          isDefault: values.get("isDefault") === "on",
        }),
      });
      setLocations((rows) =>
        rows
          .map((row) => (row.id === location.id ? data : row))
          .map((row) => (row.type === data.type && row.id !== data.id && data.isDefault ? { ...row, isDefault: false } : row)),
      );
      setIsDirty(false);
      feedback("Fulfillment location saved.", "success");
    } catch (error) {
      feedback(error instanceof Error ? error.message : "Location update failed", "error");
    }
  }

  async function addLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const values = new FormData(event.currentTarget);
      const data = await request("/api/admin/fulfillment-locations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: values.get("type"),
          nameFi: values.get("nameFi"),
          nameEn: values.get("nameEn"),
          address: values.get("address"),
          instructionsFi: values.get("instructionsFi") || "",
          instructionsEn: values.get("instructionsEn") || "",
          isDefault: values.get("isDefault") === "on",
        }),
      });
      setLocations((rows) => [...rows.filter((row) => !(row.type === data.type && data.isDefault)), data]);
      event.currentTarget.reset();
      feedback("Fulfillment location added.", "success");
    } catch (error) {
      feedback(error instanceof Error ? error.message : "Location could not be added", "error");
    }
  }

  // Order Sources Updates
  async function saveSource(event: FormEvent<HTMLFormElement>, source: Source) {
    event.preventDefault();
    try {
      const values = new FormData(event.currentTarget);
      const data = await request("/api/admin/order-sources", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: source.id,
          key: values.get("key"),
          labelFi: values.get("labelFi"),
          labelEn: values.get("labelEn"),
          sortOrder: Number(values.get("sortOrder")),
          active: values.get("active") === "on",
        }),
      });
      setSources((rows) => rows.map((row) => (row.id === source.id ? data : row)));
      setIsDirty(false);
      feedback("Order source saved.", "success");
    } catch (error) {
      feedback(error instanceof Error ? error.message : "Source update failed", "error");
    }
  }

  async function addSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const values = new FormData(event.currentTarget);
      const data = await request("/api/admin/order-sources", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          key: values.get("key"),
          labelFi: values.get("labelFi"),
          labelEn: values.get("labelEn"),
          sortOrder: Number(values.get("sortOrder") || sources.length),
        }),
      });
      setSources((rows) => [...rows, data]);
      event.currentTarget.reset();
      feedback("Order source added.", "success");
    } catch (error) {
      feedback(error instanceof Error ? error.message : "Source could not be added", "error");
    }
  }

  // Upload Page Media Asset
  async function handleMediaUpload(pageKey: string, file: File, altFi: string, altEn: string) {
    setUploadingPageKey(pageKey);
    try {
      const formData = new FormData();
      formData.append("pageKey", pageKey);
      formData.append("file", file);
      formData.append("altFi", altFi || "Kuva");
      formData.append("altEn", altEn || "Image");

      await request("/api/admin/media", {
        method: "POST",
        body: formData,
      });

      feedback(`Media asset uploaded for ${pageKey}.`, "success");
      await loadAll();
    } catch (error) {
      feedback(error instanceof Error ? error.message : "Upload failed", "error");
    } finally {
      setUploadingPageKey(null);
    }
  }

  const sections: { id: Section; label: string; icon: string; desc: string }[] = [
    { id: "identity", label: "Shop Identity", icon: "🏢", desc: "Branding, Y-Tunnus & Care lines" },
    { id: "fulfillment", label: "Fulfillment Hubs", icon: "📍", desc: "Pickup locations & directions" },
    { id: "payments", label: "Payment Methods", icon: "💳", desc: "Payment options & customer notes" },
    { id: "channels", label: "Order Channels", icon: "📥", desc: "Intake sources & ordering" },
    { id: "storefront", label: "Storefront & Media", icon: "🌐", desc: "Page visibility & CMS images" },
    { id: "danger", label: "System & Safety", icon: "🛡️", desc: "Emergency lock & overrides" },
  ];

  return (
    <section className="shell pb-20">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <AdminPageHeader
          eyebrow="ADMINISTRATION"
          title="Operational Settings & CMS"
          description="Configure branding, fulfillment hubs, payment guidance, order channels, page visibility, and brand media assets."
        />
        <Link
          href="/fi"
          target="_blank"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <span>👁️ View Live Storefront</span>
          <span aria-hidden="true">↗</span>
        </Link>
      </div>

      {message && <AdminNotice tone={tone} live>{message}</AdminNotice>}
      {!canManageSettings && (
        <AdminNotice tone="success" live>
          Read-only access. An administrator or manager must change operational settings.
        </AdminNotice>
      )}

      {/* Categorized 6-Domain Layout */}
      <div className="mt-6 grid gap-6 md:grid-cols-4">
        {/* Navigation Rail */}
        <aside className="md:col-span-1">
          <nav className="flex flex-col gap-1.5 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
            {sections.map((sec) => {
              const active = activeSection === sec.id;
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setActiveSection(sec.id)}
                  className={`flex flex-col rounded-lg px-3.5 py-3 text-left transition-colors ${
                    active
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <span>{sec.icon}</span>
                    <span>{sec.label}</span>
                  </div>
                  <span className={`mt-0.5 text-xs ${active ? "text-slate-300" : "text-slate-500"}`}>
                    {sec.desc}
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Content Area */}
        <main className="md:col-span-3 space-y-6">
          {/* DOMAIN 1: SHOP IDENTITY & CONTACT */}
          {activeSection === "identity" && (
            <div className="space-y-6">
              <form
                className="card grid gap-4"
                onSubmit={(e) => void saveShopIdentity(e)}
                onChange={() => setIsDirty(true)}
              >
                <div>
                  <h3 className="font-bold text-lg text-slate-900">🏢 Shop Identity & Legal Details</h3>
                  <p className="text-sm text-slate-600">
                    Configure public-facing brand names, consumer law compliance details, and customer care lines.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="field">
                    <span className="font-semibold text-xs text-slate-700">Finnish Shop Name (FI)</span>
                    <input
                      name="nameFi"
                      value={shopData.nameFi}
                      disabled={!canManageSettings}
                      onChange={(e) => setShopData({ ...shopData, nameFi: e.target.value })}
                      required
                    />
                  </label>
                  <label className="field">
                    <span className="font-semibold text-xs text-slate-700">English Shop Name (EN)</span>
                    <input
                      name="nameEn"
                      value={shopData.nameEn}
                      disabled={!canManageSettings}
                      onChange={(e) => setShopData({ ...shopData, nameEn: e.target.value })}
                      required
                    />
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="field">
                    <span className="font-semibold text-xs text-slate-700">Legal Business Name (Tmi / Oy)</span>
                    <input
                      name="businessName"
                      placeholder="Metsänilo Tmi"
                      value={shopData.businessName}
                      disabled={!canManageSettings}
                      onChange={(e) => setShopData({ ...shopData, businessName: e.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span className="font-semibold text-xs text-slate-700">Y-Tunnus / Business ID</span>
                    <input
                      name="businessId"
                      placeholder="1234567-8"
                      value={shopData.businessId}
                      disabled={!canManageSettings}
                      onChange={(e) => setShopData({ ...shopData, businessId: e.target.value })}
                    />
                  </label>
                </div>

                <hr className="my-2 border-slate-200" />

                <div>
                  <h4 className="font-bold text-sm text-slate-900">📞 Customer Care & Direct Lines</h4>
                  <p className="text-xs text-slate-500">Shown on storefront, receipts, and order confirmation messages.</p>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <label className="field">
                    <span className="font-semibold text-xs text-slate-700">Customer Phone / SMS</span>
                    <input
                      name="phone"
                      type="tel"
                      value={shopData.phone}
                      disabled={!canManageSettings}
                      onChange={(e) => setShopData({ ...shopData, phone: e.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span className="font-semibold text-xs text-slate-700">Support Email</span>
                    <input
                      name="email"
                      type="email"
                      value={shopData.email}
                      disabled={!canManageSettings}
                      onChange={(e) => setShopData({ ...shopData, email: e.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span className="font-semibold text-xs text-slate-700">Service Hours</span>
                    <input
                      name="hours"
                      value={shopData.hours}
                      disabled={!canManageSettings}
                      onChange={(e) => setShopData({ ...shopData, hours: e.target.value })}
                    />
                  </label>
                </div>

                {canManageSettings && (
                  <div className="mt-2">
                    <button type="submit" className="btn">
                      💾 Save Identity & Care Settings
                    </button>
                  </div>
                )}
              </form>

              {/* BRAND LOGO & FAVICON MANAGER */}
              <div className="card space-y-4">
                <h3 className="font-bold text-md text-slate-900">🏷️ Brand Logo & Favicon Assets</h3>
                <p className="text-xs text-slate-600">
                  Upload brand logos for header lockup, printed receipts, and browser tab favicons.
                </p>

                <div className="grid gap-4 md:grid-cols-2">
                  {/* Logo Card */}
                  <div className="rounded-lg border border-slate-200 p-3 space-y-2">
                    <span className="font-bold text-xs text-slate-700">Brand Logo</span>
                    {logoMedia.length > 0 ? (
                      <div className="flex items-center gap-3">
                        <img src={logoMedia[0].url} alt="Logo" className="h-10 w-auto object-contain border p-1 rounded" />
                        <span className="text-xs text-slate-500 truncate">{logoMedia[0].url}</span>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">No custom logo uploaded (using default text mark).</p>
                    )}
                    {canManageSettings && (
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploadingPageKey === "logo"}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void handleMediaUpload("logo", file, "Metsänilo Logo", "Metsänilo Logo");
                        }}
                        className="text-xs"
                      />
                    )}
                  </div>

                  {/* Favicon Card */}
                  <div className="rounded-lg border border-slate-200 p-3 space-y-2">
                    <span className="font-bold text-xs text-slate-700">Browser Favicon</span>
                    {faviconMedia.length > 0 ? (
                      <div className="flex items-center gap-3">
                        <img src={faviconMedia[0].url} alt="Favicon" className="h-8 w-8 object-contain border p-1 rounded" />
                        <span className="text-xs text-slate-500 truncate">{faviconMedia[0].url}</span>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">No custom favicon uploaded.</p>
                    )}
                    {canManageSettings && (
                      <input
                        type="file"
                        accept="image/*,.ico,.svg"
                        disabled={uploadingPageKey === "favicon"}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void handleMediaUpload("favicon", file, "Favicon", "Favicon");
                        }}
                        className="text-xs"
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* DOMAIN 2: FULFILLMENT HUBS */}
          {activeSection === "fulfillment" && (
            <div className="space-y-6">
              <div className="card space-y-4">
                <div>
                  <h3 className="font-bold text-lg text-slate-900">📍 Fulfillment & Pickup Locations</h3>
                  <p className="text-sm text-slate-600">
                    Manage where customers collect their fresh berries and delivery dispatch origins.
                  </p>
                </div>

                <div className="space-y-4">
                  {locations.map((loc) => (
                    <form
                      key={loc.id}
                      className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
                      onSubmit={(e) => void saveLocation(e, loc)}
                      onChange={() => setIsDirty(true)}
                    >
                      <div className="flex items-center justify-between gap-2 border-b pb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-800">
                            {loc.type === "PICKUP" ? "📍 Pickup Location" : "🚚 Delivery Dispatch Origin"}
                          </span>
                          {loc.isDefault && (
                            <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                              ★ Default
                            </span>
                          )}
                        </div>
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.address)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-blue-600 hover:underline"
                        >
                          🗺️ Preview on Google Maps ↗
                        </a>
                      </div>

                      <div className="grid gap-2 md:grid-cols-3">
                        <select name="type" defaultValue={loc.type} disabled={!canManageSettings} className="text-sm">
                          <option value="PICKUP">Pickup Location</option>
                          <option value="DELIVERY_ORIGIN">Delivery Origin</option>
                        </select>
                        <input
                          name="nameFi"
                          defaultValue={loc.nameFi}
                          disabled={!canManageSettings}
                          placeholder="Finnish Name"
                          required
                          className="text-sm"
                        />
                        <input
                          name="nameEn"
                          defaultValue={loc.nameEn}
                          disabled={!canManageSettings}
                          placeholder="English Name"
                          required
                          className="text-sm"
                        />
                      </div>

                      <input
                        name="address"
                        defaultValue={loc.address}
                        disabled={!canManageSettings}
                        placeholder="Street Address & City"
                        required
                        className="text-sm"
                      />

                      <div className="grid gap-2 md:grid-cols-2">
                        <input
                          name="instructionsFi"
                          defaultValue={loc.instructionsFi}
                          disabled={!canManageSettings}
                          placeholder="Finnish Pickup Instructions (e.g. Aja K1-tasolle...)"
                          className="text-sm"
                        />
                        <input
                          name="instructionsEn"
                          defaultValue={loc.instructionsEn}
                          disabled={!canManageSettings}
                          placeholder="English Pickup Instructions (e.g. Drive to level K1...)"
                          className="text-sm"
                        />
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center gap-4 text-xs font-medium text-slate-700">
                          <label className="flex items-center gap-1.5">
                            <input name="active" type="checkbox" defaultChecked={loc.active} disabled={!canManageSettings} />
                            Active
                          </label>
                          <label className="flex items-center gap-1.5">
                            <input name="isDefault" type="checkbox" defaultChecked={loc.isDefault} disabled={!canManageSettings} />
                            Set as Default for this Type
                          </label>
                        </div>
                        {canManageSettings && (
                          <button type="submit" className="btn btn-secondary text-xs">
                            Save Location
                          </button>
                        )}
                      </div>
                    </form>
                  ))}
                </div>

                {canManageSettings && (
                  <form className="rounded-xl border border-dashed border-slate-300 p-4 space-y-3" onSubmit={(e) => void addLocation(e)}>
                    <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider">➕ Add New Location</h4>
                    <div className="grid gap-2 md:grid-cols-4">
                      <select name="type" className="text-sm">
                        <option value="PICKUP">Pickup Location</option>
                        <option value="DELIVERY_ORIGIN">Delivery Origin</option>
                      </select>
                      <input name="nameFi" placeholder="Finnish Name" required className="text-sm" />
                      <input name="nameEn" placeholder="English Name" required className="text-sm" />
                      <input name="address" placeholder="Address" required className="text-sm" />
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      <input name="instructionsFi" placeholder="Finnish Instructions" className="text-sm" />
                      <input name="instructionsEn" placeholder="English Instructions" className="text-sm" />
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-1.5 text-xs">
                        <input name="isDefault" type="checkbox" /> Default
                      </label>
                      <button type="submit" className="btn text-xs">
                        Add Location
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* DOMAIN 3: PAYMENT METHODS */}
          {activeSection === "payments" && (
            <div className="space-y-6">
              <div className="card space-y-4">
                <div>
                  <h3 className="font-bold text-lg text-slate-900">💳 Payment Methods & Customer Guidance</h3>
                  <p className="text-sm text-slate-600">
                    Enable or disable payment options accepted at pickup or delivery and configure custom customer instructions.
                  </p>
                </div>

                <div className="space-y-4">
                  {methods.map((method) => (
                    <div key={method.method} className="rounded-xl border border-slate-200 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-md text-slate-900">
                          {method.method === "MOBILEPAY"
                            ? "📱 MobilePay"
                            : method.method === "CASH"
                            ? "💵 Käteinen / Cash at Pickup"
                            : method.method === "CARD"
                            ? "💳 Korttimaksu / Card at Pickup"
                            : method.method === "BANK_TRANSFER"
                            ? "🏦 Pankkisiirto / Bank Invoice (B2B)"
                            : "📦 Other Payment"}
                        </span>
                        <label className="flex items-center gap-2 font-semibold text-xs">
                          <span>{method.enabled ? "🟢 Enabled" : "⚪ Disabled"}</span>
                          <input
                            type="checkbox"
                            checked={method.enabled}
                            disabled={!canManageSettings}
                            onChange={() => {
                              void savePaymentMethod({ ...method, enabled: !method.enabled });
                            }}
                          />
                        </label>
                      </div>

                      <div className="grid gap-2 md:grid-cols-2">
                        <label className="field">
                          <span className="font-semibold text-xs text-slate-700">Customer Note (FI)</span>
                          <input
                            defaultValue={method.instructionsFi ?? ""}
                            placeholder={
                              method.method === "MOBILEPAY"
                                ? "Maksu noudettaessa MobilePaylla numeroon 89123."
                                : "Ohje asiakkaalle..."
                            }
                            disabled={!canManageSettings}
                            onBlur={(e) => {
                              void savePaymentMethod({ ...method, instructionsFi: e.target.value });
                            }}
                          />
                        </label>
                        <label className="field">
                          <span className="font-semibold text-xs text-slate-700">Customer Note (EN)</span>
                          <input
                            defaultValue={method.instructionsEn ?? ""}
                            placeholder={
                              method.method === "MOBILEPAY"
                                ? "Pay via MobilePay to number 89123 at pickup."
                                : "Instructions for customer..."
                            }
                            disabled={!canManageSettings}
                            onBlur={(e) => {
                              void savePaymentMethod({ ...method, instructionsEn: e.target.value });
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* DOMAIN 4: ORDER CHANNELS */}
          {activeSection === "channels" && (
            <div className="space-y-6">
              <div className="card space-y-4">
                <div>
                  <h3 className="font-bold text-lg text-slate-900">📥 Order Intake Channels & Attribution</h3>
                  <p className="text-sm text-slate-600">
                    Customize order intake sources (Phone, WhatsApp, Facebook, Market Stall) for rapid manual entry and sales reporting.
                  </p>
                </div>

                <div className="space-y-3">
                  {sources.map((source) => (
                    <form
                      key={source.id}
                      className="grid gap-2 rounded-xl border border-slate-200 p-3 md:grid-cols-6 items-center"
                      onSubmit={(e) => void saveSource(e, source)}
                      onChange={() => setIsDirty(true)}
                    >
                      <input name="key" defaultValue={source.key} disabled={!canManageSettings} required className="text-sm font-mono" />
                      <input name="labelFi" defaultValue={source.labelFi} disabled={!canManageSettings} required className="text-sm" />
                      <input name="labelEn" defaultValue={source.labelEn} disabled={!canManageSettings} required className="text-sm" />
                      <input name="sortOrder" type="number" min="0" defaultValue={source.sortOrder} disabled={!canManageSettings} className="text-sm" />
                      <label className="flex items-center gap-1.5 text-xs font-semibold">
                        <input name="active" type="checkbox" defaultChecked={source.active} disabled={!canManageSettings} />
                        Active
                      </label>
                      {canManageSettings && (
                        <button type="submit" className="btn btn-secondary text-xs">
                          Save Source
                        </button>
                      )}
                    </form>
                  ))}
                </div>

                {canManageSettings && (
                  <form className="rounded-xl border border-dashed border-slate-300 p-4 space-y-3" onSubmit={(e) => void addSource(e)}>
                    <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider">➕ Add Custom Order Source</h4>
                    <div className="grid gap-2 md:grid-cols-4">
                      <input name="key" placeholder="KEY (e.g. INSTAGRAM)" required className="text-sm font-mono" />
                      <input name="labelFi" placeholder="Finnish Label" required className="text-sm" />
                      <input name="labelEn" placeholder="English Label" required className="text-sm" />
                      <button type="submit" className="btn text-xs">
                        Add Source
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* DOMAIN 5: STOREFRONT & MEDIA */}
          {activeSection === "storefront" && (
            <div className="space-y-6">
              <form
                className="card space-y-4"
                onSubmit={(e) => void saveShopIdentity(e)}
                onChange={() => setIsDirty(true)}
              >
                <div>
                  <h3 className="font-bold text-lg text-slate-900">🌐 Storefront Page Visibility Switches</h3>
                  <p className="text-sm text-slate-600">
                    Control which public pages are active. Disabling a page hides its link from navigation headers, drawers, and footers, and returns 404 on direct access.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  {/* How it works toggle */}
                  <div className="rounded-xl border border-slate-200 p-4 space-y-2">
                    <span className="font-bold text-sm text-slate-800">📘 How It Works Page</span>
                    <label className="flex items-center justify-between text-xs font-semibold">
                      <span>{shopData.howItWorksVisible ? "🟢 Visible" : "🔴 Hidden (404)"}</span>
                      <input
                        type="checkbox"
                        checked={shopData.howItWorksVisible}
                        disabled={!canManageSettings}
                        onChange={(e) => setShopData({ ...shopData, howItWorksVisible: e.target.checked })}
                      />
                    </label>
                  </div>

                  {/* Reviews toggle */}
                  <div className="rounded-xl border border-slate-200 p-4 space-y-2">
                    <span className="font-bold text-sm text-slate-800">⭐️ Reviews Hub Page</span>
                    <label className="flex items-center justify-between text-xs font-semibold">
                      <span>{shopData.reviewsVisible ? "🟢 Visible" : "🔴 Hidden (404)"}</span>
                      <input
                        type="checkbox"
                        checked={shopData.reviewsVisible}
                        disabled={!canManageSettings}
                        onChange={(e) => setShopData({ ...shopData, reviewsVisible: e.target.checked })}
                      />
                    </label>
                  </div>

                  {/* About Us toggle */}
                  <div className="rounded-xl border border-slate-200 p-4 space-y-2">
                    <span className="font-bold text-sm text-slate-800">🌲 About Us Story Page</span>
                    <label className="flex items-center justify-between text-xs font-semibold">
                      <span>{shopData.aboutUsVisible ? "🟢 Visible" : "🔴 Hidden (404)"}</span>
                      <input
                        type="checkbox"
                        checked={shopData.aboutUsVisible}
                        disabled={!canManageSettings}
                        onChange={(e) => setShopData({ ...shopData, aboutUsVisible: e.target.checked })}
                      />
                    </label>
                  </div>
                </div>

                {canManageSettings && (
                  <button type="submit" className="btn">
                    💾 Save Page Visibility Switches
                  </button>
                )}
              </form>

              {/* PAGE MEDIA MANAGERS */}
              <div className="card space-y-6">
                <div>
                  <h3 className="font-bold text-lg text-slate-900">🖼️ Storefront Page Media Managers</h3>
                  <p className="text-sm text-slate-600">
                    Upload, replace, or update imagery for Homepage Hero, How It Works, and About Us story.
                  </p>
                </div>

                {/* Hero Media */}
                <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                  <span className="font-bold text-sm text-slate-800">🌲 Homepage Hero Banner</span>
                  {heroMedia.length > 0 ? (
                    <div className="flex items-center gap-4">
                      <img src={heroMedia[0].url} alt={heroMedia[0].altFi} className="h-20 w-36 object-cover rounded border" />
                      <span className="text-xs text-slate-500 truncate">{heroMedia[0].url}</span>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">No custom hero image uploaded (using default theme fallback).</p>
                  )}
                  {canManageSettings && (
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploadingPageKey === "hero"}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleMediaUpload("hero", file, "Hero Kuva", "Hero Image");
                      }}
                      className="text-xs"
                    />
                  )}
                </div>

                {/* How it works Media */}
                <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                  <span className="font-bold text-sm text-slate-800">📘 How It Works Process Media</span>
                  {howMedia.length > 0 ? (
                    <div className="flex flex-wrap gap-3">
                      {howMedia.map((m) => (
                        <img key={m.id} src={m.url} alt={m.altFi} className="h-16 w-24 object-cover rounded border" />
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">No process step graphics uploaded.</p>
                  )}
                  {canManageSettings && (
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploadingPageKey === "how-it-works"}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleMediaUpload("how-it-works", file, "Miten toimii kuva", "How it works image");
                      }}
                      className="text-xs"
                    />
                  )}
                </div>

                {/* About Us Media */}
                <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                  <span className="font-bold text-sm text-slate-800">📖 About Us Story & Forest Media</span>
                  {aboutMedia.length > 0 ? (
                    <div className="flex flex-wrap gap-3">
                      {aboutMedia.map((m) => (
                        <img key={m.id} src={m.url} alt={m.altFi} className="h-16 w-24 object-cover rounded border" />
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">No story harvest photos uploaded.</p>
                  )}
                  {canManageSettings && (
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploadingPageKey === "about-us"}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleMediaUpload("about-us", file, "Satakunnan metsä", "Satakunta forest");
                      }}
                      className="text-xs"
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* DOMAIN 6: DANGER ZONE & SAFETY */}
          {activeSection === "danger" && (
            <div className="space-y-6">
              <div className="card space-y-4 border-red-200 bg-red-50/20">
                <div>
                  <h3 className="font-bold text-lg text-red-900">🚨 DANGER ZONE & EMERGENCY OVERRIDES</h3>
                  <p className="text-sm text-red-700">
                    High-security administrative controls protected behind double-confirmation actions.
                  </p>
                </div>

                {/* Emergency Intake Pause */}
                <div className="rounded-xl border border-red-200 bg-white p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">1. Emergency Storefront Intake Pause</h4>
                      <p className="text-xs text-slate-600">
                        Temporarily stop all public web reservations across all dates during harvest emergencies or storms.
                      </p>
                    </div>
                    <span className={`font-bold text-xs ${shopData.active ? "text-emerald-600" : "text-red-600"}`}>
                      {shopData.active ? "🟢 Intake Open" : "🔴 INTAKE PAUSED"}
                    </span>
                  </div>

                  {canManageSettings && (
                    <button
                      type="button"
                      className={`btn text-xs ${shopData.active ? "btn-danger" : "btn-accent"}`}
                      onClick={() => {
                        const nextState = !shopData.active;
                        if (
                          window.confirm(
                            `Are you sure you want to ${nextState ? "RESUME" : "PAUSE"} storefront web reservations?`,
                          )
                        ) {
                          setShopData({ ...shopData, active: nextState });
                          void saveShopIdentity();
                        }
                      }}
                    >
                      {shopData.active ? "⏸️ Pause Public Web Intake (Emergency Lock)" : "▶️ Resume Public Web Intake"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Floating Dirty-State Save Bar */}
      {isDirty && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 rounded-xl bg-slate-900 px-6 py-3 text-white shadow-2xl animate-bounce">
          <span className="text-sm font-semibold">⚠️ You have unsaved changes in Settings.</span>
          <button
            type="button"
            className="rounded bg-slate-700 px-3 py-1 text-xs font-semibold hover:bg-slate-600"
            onClick={() => void loadAll()}
          >
            Discard
          </button>
          <button
            type="button"
            className="rounded bg-emerald-500 px-3.5 py-1 text-xs font-bold hover:bg-emerald-400"
            onClick={() => void saveShopIdentity()}
          >
            💾 Save Changes
          </button>
        </div>
      )}
    </section>
  );
}
