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

function ImageDropzone({
  label,
  description,
  currentUrl,
  defaultFallbackUrl = "/metsanilo-leaf.svg",
  pageKey,
  onUpload,
  onRemove,
  isUploading,
  disabled,
}: {
  label: string;
  description: string;
  currentUrl?: string | null;
  defaultFallbackUrl?: string;
  pageKey: string;
  onUpload: (file: File, altFi: string, altEn: string) => Promise<void>;
  onRemove?: () => Promise<void>;
  isUploading?: boolean;
  disabled?: boolean;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [altFi, setAltFi] = useState("");
  const [altEn, setAltEn] = useState("");

  const displayUrl = currentUrl || defaultFallbackUrl;

  async function handleFileSelected(file: File) {
    if (!file || disabled) return;
    await onUpload(file, altFi || label, altEn || label);
  }

  return (
    <div className="card p-4 border border-line bg-surface flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="font-bold text-sm text-ink">{label}</h4>
          <p className="text-xs muted">{description}</p>
        </div>
        {currentUrl && onRemove && !disabled && (
          <button
            type="button"
            className="btn btn-secondary text-xs text-danger font-bold py-1 px-2.5"
            onClick={() => void onRemove()}
          >
            🗑️ Remove Custom Asset
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
        {/* Preview Frame */}
        <div className="sm:col-span-1 flex flex-col items-center justify-center p-3 rounded-xl border border-line bg-surface-muted/40 text-center">
          <div className="w-20 h-20 relative flex items-center justify-center rounded-xl overflow-hidden bg-surface border border-line p-2 shadow-2xs">
            <img src={displayUrl} alt={label} className="max-w-full max-h-full object-contain" />
          </div>
          <span className="text-[10px] font-bold text-ink/70 mt-1.5 truncate max-w-[140px]">
            {currentUrl ? "Custom Active Asset" : "Brand SVG Fallback"}
          </span>
        </div>

        {/* Drag and Drop Zone */}
        {!disabled && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              const file = e.dataTransfer.files[0];
              if (file) void handleFileSelected(file);
            }}
            className={`sm:col-span-2 border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center text-center transition-colors cursor-pointer ${
              isDragOver ? "border-primary bg-primary/5" : "border-line hover:border-primary/50 hover:bg-surface-muted/30"
            }`}
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = "image/png,image/svg+xml,image/webp,image/x-icon,image/jpeg";
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) void handleFileSelected(file);
              };
              input.click();
            }}
          >
            <span className="text-2xl mb-1">📁</span>
            <p className="text-xs font-bold text-ink">
              {isUploading ? "⏳ Uploading brand asset..." : "Drag & Drop image file here or Click to browse"}
            </p>
            <p className="text-[11px] muted mt-0.5">Supports PNG, SVG, WEBP, ICO (Max 2 MB)</p>
          </div>
        )}
      </div>
    </div>
  );
}

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
      feedback(error instanceof Error ? error.message : "Could not save settings", "error");
    }
  }

  // Save Fulfillment Location
  async function saveLocation(event: FormEvent<HTMLFormElement>, location: Location) {
    event.preventDefault();
    try {
      const values = new FormData(event.currentTarget);
      const updated = await request("/api/admin/fulfillment-locations", {
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

      setLocations((rows) => rows.map((row) => (row.id === location.id ? updated : row)));
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
      setLocations((rows) => [...rows, data]);
      event.currentTarget.reset();
      feedback("Fulfillment location added.", "success");
    } catch (error) {
      feedback(error instanceof Error ? error.message : "Location could not be added", "error");
    }
  }

  async function deleteLocationItem(id: string) {
    if (!confirm("Are you sure you want to delete this fulfillment location?")) return;
    try {
      await request(`/api/admin/fulfillment-locations?id=${id}`, { method: "DELETE" });
      feedback("Fulfillment location deleted.", "success");
      await loadAll();
    } catch (error) {
      feedback(error instanceof Error ? error.message : "Could not delete location", "error");
    }
  }

  // Save Payment Method
  async function savePaymentMethod(method: Method) {
    try {
      const updated = await request("/api/admin/payment-methods", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(method),
      });
      setMethods((rows) => rows.map((r) => (r.method === method.method ? updated : r)));
      feedback("Payment method settings updated.", "success");
    } catch (error) {
      feedback(error instanceof Error ? error.message : "Payment method update failed", "error");
    }
  }

  async function deletePaymentMethodItem(methodKey: string) {
    if (!confirm(`Are you sure you want to delete custom payment method '${methodKey}'?`)) return;
    try {
      await request(`/api/admin/payment-methods?method=${methodKey}`, { method: "DELETE" });
      feedback("Payment method deleted.", "success");
      await loadAll();
    } catch (error) {
      feedback(error instanceof Error ? error.message : "Could not delete payment method", "error");
    }
  }

  // Save Order Source
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
      feedback("Order intake channel saved.", "success");
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
      feedback("Order intake channel added.", "success");
    } catch (error) {
      feedback(error instanceof Error ? error.message : "Source could not be added", "error");
    }
  }

  async function deleteOrderSourceItem(id: string) {
    if (!confirm("Are you sure you want to delete this intake channel?")) return;
    try {
      await request(`/api/admin/order-sources?id=${id}`, { method: "DELETE" });
      feedback("Order intake channel deleted.", "success");
      await loadAll();
    } catch (error) {
      feedback(error instanceof Error ? error.message : "Could not delete channel", "error");
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

  async function deleteMediaAttachmentItem(attachmentId: string, pageKey: string) {
    try {
      await request(`/api/admin/media?attachmentId=${attachmentId}`, { method: "DELETE" });
      feedback(`Media asset deleted for ${pageKey}.`, "success");
      await loadAll();
    } catch (error) {
      feedback(error instanceof Error ? error.message : "Could not delete media asset", "error");
    }
  }

  const sections: { id: Section; label: string; icon: string; desc: string }[] = [
    { id: "identity", label: "Shop Identity", icon: "🏢", desc: "Branding, Logo & Care lines" },
    { id: "fulfillment", label: "Fulfillment Hubs", icon: "📍", desc: "Pickup locations & directions" },
    { id: "payments", label: "Payment Methods", icon: "💳", desc: "Payment guidance & instructions" },
    { id: "channels", label: "Order Channels", icon: "📥", desc: "Intake sources & attribution" },
    { id: "storefront", label: "Storefront & Media", icon: "🌐", desc: "Page visibility & CMS graphics" },
    { id: "danger", label: "System & Safety", icon: "🛡️", desc: "Emergency intake lock & overrides" },
  ];

  return (
    <section className="shell pb-20 flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <AdminPageHeader
          eyebrow="ADMINISTRATION"
          title="Operational Settings & CMS"
          description="Configure branding assets, fulfillment hubs, payment guidance, intake channels, page visibility, and storefront CMS images."
        />
        <Link
          href="/fi"
          target="_blank"
          className="btn btn-secondary text-xs font-bold flex items-center gap-1.5 shadow-2xs"
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

      {/* MODERN HORIZONTAL SEGMENTED TOP TAB BAR */}
      <nav className="flex items-center gap-1 overflow-x-auto p-1 bg-surface-muted/60 border border-line rounded-2xl">
        {sections.map((sec) => {
          const active = activeSection === sec.id;
          return (
            <button
              key={sec.id}
              type="button"
              onClick={() => setActiveSection(sec.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                active
                  ? "bg-surface text-primary shadow-xs border border-line"
                  : "text-muted hover:text-ink hover:bg-surface/50"
              }`}
            >
              <span>{sec.icon}</span>
              <span>{sec.label}</span>
            </button>
          );
        })}
      </nav>

      {/* MAIN CONTENT WORKSPACE */}
      <main className="flex flex-col gap-6">
        {/* DOMAIN 1: SHOP IDENTITY & BRAND ASSETS */}
        {activeSection === "identity" && (
          <div className="flex flex-col gap-6">
            <form
              className="card p-5 grid gap-4 border border-line"
              onSubmit={(e) => void saveShopIdentity(e)}
              onChange={() => setIsDirty(true)}
            >
              <div>
                <h3 className="font-bold text-lg text-ink">🏢 Shop Identity &amp; Legal Details</h3>
                <p className="text-xs muted">
                  Configure public-facing brand names, consumer law compliance details, and customer care lines.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="field">
                  <span className="font-semibold text-xs text-ink">Finnish Shop Name (FI)</span>
                  <input
                    name="nameFi"
                    value={shopData.nameFi}
                    disabled={!canManageSettings}
                    onChange={(e) => setShopData({ ...shopData, nameFi: e.target.value })}
                    required
                  />
                </label>
                <label className="field">
                  <span className="font-semibold text-xs text-ink">English Shop Name (EN)</span>
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
                  <span className="font-semibold text-xs text-ink">Legal Business Name (Tmi / Oy)</span>
                  <input
                    name="businessName"
                    placeholder="Metsänilo Tmi"
                    value={shopData.businessName}
                    disabled={!canManageSettings}
                    onChange={(e) => setShopData({ ...shopData, businessName: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span className="font-semibold text-xs text-ink">Y-Tunnus / Business ID</span>
                  <input
                    name="businessId"
                    placeholder="1234567-8"
                    value={shopData.businessId}
                    disabled={!canManageSettings}
                    onChange={(e) => setShopData({ ...shopData, businessId: e.target.value })}
                  />
                </label>
              </div>

              <hr className="my-1 border-line" />

              <div>
                <h4 className="font-bold text-sm text-ink">📞 Customer Care &amp; Direct Lines</h4>
                <p className="text-xs muted">Shown on storefront, receipts, and order confirmation messages.</p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <label className="field">
                  <span className="font-semibold text-xs text-ink">Customer Phone / SMS</span>
                  <input
                    name="phone"
                    type="tel"
                    value={shopData.phone}
                    disabled={!canManageSettings}
                    onChange={(e) => setShopData({ ...shopData, phone: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span className="font-semibold text-xs text-ink">Support Email</span>
                  <input
                    name="email"
                    type="email"
                    value={shopData.email}
                    disabled={!canManageSettings}
                    onChange={(e) => setShopData({ ...shopData, email: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span className="font-semibold text-xs text-ink">Service Hours</span>
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
                  <button type="submit" className="btn font-bold text-xs">
                    💾 Save Identity &amp; Care Settings
                  </button>
                </div>
              )}
            </form>

            {/* BRAND LOGO & FAVICON DRAG-AND-DROP MANAGERS */}
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="font-bold text-base text-ink">🏷️ Brand Logo &amp; Favicon Asset Managers</h3>
                <p className="text-xs muted">
                  Interactive Drag-and-Drop image upload for brand header mark, receipts, and browser tab icons. Defaults to 3-leaf Metsänilo SVG icon.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <ImageDropzone
                  label="Brand Header Logo"
                  description="Main logo displayed on storefront header lockup & receipts."
                  currentUrl={logoMedia[0]?.url || shopData.logoUrl}
                  defaultFallbackUrl="/metsanilo-leaf.svg"
                  pageKey="logo"
                  onUpload={(file, altFi, altEn) => handleMediaUpload("logo", file, altFi, altEn)}
                  onRemove={logoMedia[0] ? () => deleteMediaAttachmentItem(logoMedia[0].attachmentId!, "logo") : undefined}
                  isUploading={uploadingPageKey === "logo"}
                  disabled={!canManageSettings}
                />

                <ImageDropzone
                  label="Browser Favicon Icon"
                  description="Favicon displayed in browser tabs & bookmarks."
                  currentUrl={faviconMedia[0]?.url || shopData.faviconUrl}
                  defaultFallbackUrl="/metsanilo-leaf.svg"
                  pageKey="favicon"
                  onUpload={(file, altFi, altEn) => handleMediaUpload("favicon", file, altFi, altEn)}
                  onRemove={faviconMedia[0] ? () => deleteMediaAttachmentItem(faviconMedia[0].attachmentId!, "favicon") : undefined}
                  isUploading={uploadingPageKey === "favicon"}
                  disabled={!canManageSettings}
                />
              </div>
            </div>
          </div>
        )}

        {/* DOMAIN 2: FULFILLMENT HUBS */}
        {activeSection === "fulfillment" && (
          <div className="card p-5 flex flex-col gap-4 border border-line">
            <div>
              <h3 className="font-bold text-lg text-ink">📍 Fulfillment &amp; Pickup Locations</h3>
              <p className="text-xs muted">
                Manage where customers collect their fresh berries and delivery dispatch origins.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              {locations.map((loc) => (
                <form
                  key={loc.id}
                  className="grid gap-3 rounded-xl border border-line bg-surface-muted/30 p-4"
                  onSubmit={(e) => void saveLocation(e, loc)}
                  onChange={() => setIsDirty(true)}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-ink">
                        {loc.type === "PICKUP" ? "📍 Pickup Location" : "🚚 Delivery Dispatch Origin"}
                      </span>
                      {loc.isDefault && (
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-900 border border-amber-300">
                          ⭐ Default Hub
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.address)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                      >
                        🗺️ Preview on Maps ↗
                      </a>

                      {!loc.isDefault && canManageSettings && (
                        <button
                          type="button"
                          className="btn btn-secondary text-xs text-danger py-1 px-2 font-bold"
                          onClick={() => void deleteLocationItem(loc.id)}
                        >
                          🗑️ Delete
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-2 md:grid-cols-3">
                    <select name="type" defaultValue={loc.type} disabled={!canManageSettings} className="text-xs">
                      <option value="PICKUP">Pickup Location</option>
                      <option value="DELIVERY_ORIGIN">Delivery Origin</option>
                    </select>
                    <input
                      name="nameFi"
                      defaultValue={loc.nameFi}
                      disabled={!canManageSettings}
                      placeholder="Finnish Name"
                      required
                      className="text-xs"
                    />
                    <input
                      name="nameEn"
                      defaultValue={loc.nameEn}
                      disabled={!canManageSettings}
                      placeholder="English Name"
                      required
                      className="text-xs"
                    />
                  </div>

                  <input
                    name="address"
                    defaultValue={loc.address}
                    disabled={!canManageSettings}
                    placeholder="Street Address & City"
                    required
                    className="text-xs"
                  />

                  <div className="grid gap-2 md:grid-cols-2">
                    <input
                      name="instructionsFi"
                      defaultValue={loc.instructionsFi}
                      disabled={!canManageSettings}
                      placeholder="Finnish Pickup Instructions (e.g. Aja K1-tasolle...)"
                      className="text-xs"
                    />
                    <input
                      name="instructionsEn"
                      defaultValue={loc.instructionsEn}
                      disabled={!canManageSettings}
                      placeholder="English Pickup Instructions (e.g. Drive to level K1...)"
                      className="text-xs"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-4 text-xs font-medium text-ink">
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
                      <button type="submit" className="btn text-xs font-bold">
                        Save Location
                      </button>
                    )}
                  </div>
                </form>
              ))}
            </div>

            {canManageSettings && (
              <form className="rounded-xl border border-dashed border-line p-4 flex flex-col gap-3 mt-2" onSubmit={(e) => void addLocation(e)}>
                <h4 className="font-bold text-xs text-ink uppercase tracking-wider">➕ Add New Fulfillment Hub</h4>
                <div className="grid gap-2 md:grid-cols-4">
                  <select name="type" className="text-xs">
                    <option value="PICKUP">Pickup Location</option>
                    <option value="DELIVERY_ORIGIN">Delivery Origin</option>
                  </select>
                  <input name="nameFi" placeholder="Finnish Name" required className="text-xs" />
                  <input name="nameEn" placeholder="English Name" required className="text-xs" />
                  <input name="address" placeholder="Address" required className="text-xs" />
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <input name="instructionsFi" placeholder="Finnish Instructions" className="text-xs" />
                  <input name="instructionsEn" placeholder="English Instructions" className="text-xs" />
                </div>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-xs font-semibold">
                    <input name="isDefault" type="checkbox" /> Set Default
                  </label>
                  <button type="submit" className="btn text-xs font-bold">
                    Add Location
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* DOMAIN 3: PAYMENT METHODS */}
        {activeSection === "payments" && (
          <div className="card p-5 flex flex-col gap-4 border border-line">
            <div>
              <h3 className="font-bold text-lg text-ink">💳 Payment Methods &amp; Customer Guidance</h3>
              <p className="text-xs muted">
                System default payment options (MobilePay, Bank Transfer, Cash) are protected. Custom methods can be created and deleted if unused.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              {methods.map((method) => {
                const isSystemDefault = ["CASH", "BANK_TRANSFER", "MOBILEPAY"].includes(method.method);

                return (
                  <div key={method.method} className="rounded-xl border border-line p-4 flex flex-col gap-3 bg-surface-muted/20">
                    <div className="flex items-center justify-between border-b border-line pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-ink">
                          {method.method === "MOBILEPAY"
                            ? "📱 MobilePay"
                            : method.method === "CASH"
                            ? "💵 Käteinen / Cash at Pickup"
                            : method.method === "CARD"
                            ? "💳 Korttimaksu / Card at Pickup"
                            : method.method === "BANK_TRANSFER"
                            ? "🏦 Pankkisiirto / Bank Invoice (B2B)"
                            : `📦 Custom: ${method.method}`}
                        </span>
                        {isSystemDefault ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-300">
                            🔒 System Default
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                            Custom Method
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 font-bold text-xs">
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

                        {!isSystemDefault && canManageSettings && (
                          <button
                            type="button"
                            className="btn btn-secondary text-xs text-danger font-bold py-1 px-2"
                            onClick={() => void deletePaymentMethodItem(method.method)}
                          >
                            🗑️ Delete
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-2 md:grid-cols-2">
                      <label className="field">
                        <span className="font-semibold text-xs text-ink">Customer Instruction Note (FI)</span>
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
                        <span className="font-semibold text-xs text-ink">Customer Instruction Note (EN)</span>
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
                );
              })}
            </div>
          </div>
        )}

        {/* DOMAIN 4: ORDER CHANNELS */}
        {activeSection === "channels" && (
          <div className="card p-5 flex flex-col gap-4 border border-line">
            <div>
              <h3 className="font-bold text-lg text-ink">📥 Order Intake Channels &amp; Attribution</h3>
              <p className="text-xs muted">
                System core channels (Website, Manual, Historical) are protected. Custom channels can be added or deleted if unused.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {sources.map((source) => {
                const isCoreChannel = ["WEBSITE", "MANUAL", "HISTORICAL"].includes(source.key);

                return (
                  <form
                    key={source.id}
                    className="grid gap-2 rounded-xl border border-line p-3 md:grid-cols-6 items-center bg-surface-muted/20"
                    onSubmit={(e) => void saveSource(e, source)}
                    onChange={() => setIsDirty(true)}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <input name="key" defaultValue={source.key} disabled={!canManageSettings || isCoreChannel} required className="text-xs font-mono font-bold" />
                      {isCoreChannel && (
                        <span title="System Core Channel" className="text-[10px] text-blue-900 font-bold">🔒</span>
                      )}
                    </div>

                    <input name="labelFi" defaultValue={source.labelFi} disabled={!canManageSettings} required className="text-xs" />
                    <input name="labelEn" defaultValue={source.labelEn} disabled={!canManageSettings} required className="text-xs" />
                    <input name="sortOrder" type="number" min="0" defaultValue={source.sortOrder} disabled={!canManageSettings} className="text-xs" />

                    <label className="flex items-center gap-1.5 text-xs font-semibold">
                      <input name="active" type="checkbox" defaultChecked={source.active} disabled={!canManageSettings} />
                      Active
                    </label>

                    <div className="flex items-center justify-end gap-2">
                      {canManageSettings && (
                        <button type="submit" className="btn btn-secondary text-xs font-bold">
                          Save
                        </button>
                      )}
                      {!isCoreChannel && canManageSettings && (
                        <button
                          type="button"
                          className="btn btn-secondary text-xs text-danger font-bold py-1 px-2"
                          onClick={() => void deleteOrderSourceItem(source.id)}
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </form>
                );
              })}
            </div>

            {canManageSettings && (
              <form className="rounded-xl border border-dashed border-line p-4 flex flex-col gap-3 mt-2" onSubmit={(e) => void addSource(e)}>
                <h4 className="font-bold text-xs text-ink uppercase tracking-wider">➕ Add Custom Order Intake Channel</h4>
                <div className="grid gap-2 md:grid-cols-4">
                  <input name="key" placeholder="KEY (e.g. INSTAGRAM)" required className="text-xs font-mono font-bold" />
                  <input name="labelFi" placeholder="Finnish Label" required className="text-xs" />
                  <input name="labelEn" placeholder="English Label" required className="text-xs" />
                  <button type="submit" className="btn text-xs font-bold">
                    Add Channel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* DOMAIN 5: STOREFRONT & CMS */}
        {activeSection === "storefront" && (
          <div className="flex flex-col gap-6">
            <form
              className="card p-5 flex flex-col gap-4 border border-line"
              onSubmit={(e) => void saveShopIdentity(e)}
              onChange={() => setIsDirty(true)}
            >
              <div>
                <h3 className="font-bold text-lg text-ink">🌐 Storefront Page Visibility Switches</h3>
                <p className="text-xs muted">
                  Control active storefront pages. Disabling a page hides its link from navigation menus and returns 404 on direct access.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {/* How it works toggle */}
                <div className="rounded-xl border border-line p-4 flex flex-col gap-2 bg-surface-muted/30">
                  <span className="font-bold text-xs text-ink">📘 How It Works Page</span>
                  <label className="flex items-center justify-between text-xs font-bold">
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
                <div className="rounded-xl border border-line p-4 flex flex-col gap-2 bg-surface-muted/30">
                  <span className="font-bold text-xs text-ink">⭐️ Reviews Hub Page</span>
                  <label className="flex items-center justify-between text-xs font-bold">
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
                <div className="rounded-xl border border-line p-4 flex flex-col gap-2 bg-surface-muted/30">
                  <span className="font-bold text-xs text-ink">🌲 About Us Story Page</span>
                  <label className="flex items-center justify-between text-xs font-bold">
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
                <div>
                  <button type="submit" className="btn text-xs font-bold">
                    💾 Save Page Visibility Switches
                  </button>
                </div>
              )}
            </form>

            {/* PAGE MEDIA MANAGERS */}
            <div className="card p-5 flex flex-col gap-5 border border-line">
              <div>
                <h3 className="font-bold text-lg text-ink">🖼️ Storefront Page Media Managers</h3>
                <p className="text-xs muted">
                  Drag &amp; drop imagery for Homepage Hero, How It Works process steps, and About Us story.
                </p>
              </div>

              {/* Hero Media */}
              <ImageDropzone
                label="Homepage Hero Banner"
                description="Hero banner image for storefront homepage."
                currentUrl={heroMedia[0]?.url}
                defaultFallbackUrl="/metsanilo-leaf.svg"
                pageKey="hero"
                onUpload={(file, altFi, altEn) => handleMediaUpload("hero", file, altFi, altEn)}
                onRemove={heroMedia[0] ? () => deleteMediaAttachmentItem(heroMedia[0].attachmentId!, "hero") : undefined}
                isUploading={uploadingPageKey === "hero"}
                disabled={!canManageSettings}
              />

              {/* How it works Media */}
              <ImageDropzone
                label="How It Works Process Media"
                description="Process step diagrams and illustrations."
                currentUrl={howMedia[0]?.url}
                defaultFallbackUrl="/metsanilo-leaf.svg"
                pageKey="how-it-works"
                onUpload={(file, altFi, altEn) => handleMediaUpload("how-it-works", file, altFi, altEn)}
                onRemove={howMedia[0] ? () => deleteMediaAttachmentItem(howMedia[0].attachmentId!, "how-it-works") : undefined}
                isUploading={uploadingPageKey === "how-it-works"}
                disabled={!canManageSettings}
              />

              {/* About Us Media */}
              <ImageDropzone
                label="About Us Story & Forest Media"
                description="Forest harvest photos for brand story page."
                currentUrl={aboutMedia[0]?.url}
                defaultFallbackUrl="/metsanilo-leaf.svg"
                pageKey="about-us"
                onUpload={(file, altFi, altEn) => handleMediaUpload("about-us", file, altFi, altEn)}
                onRemove={aboutMedia[0] ? () => deleteMediaAttachmentItem(aboutMedia[0].attachmentId!, "about-us") : undefined}
                isUploading={uploadingPageKey === "about-us"}
                disabled={!canManageSettings}
              />
            </div>
          </div>
        )}

        {/* DOMAIN 6: DANGER ZONE & SAFETY */}
        {activeSection === "danger" && (
          <div className="card p-5 flex flex-col gap-4 border border-rose-200 bg-rose-50/20">
            <div>
              <h3 className="font-bold text-lg text-rose-900">🚨 DANGER ZONE &amp; EMERGENCY OVERRIDES</h3>
              <p className="text-xs text-rose-800 font-medium">
                High-security administrative controls protected behind double-confirmation actions.
              </p>
            </div>

            {/* Emergency Intake Pause */}
            <div className="rounded-xl border border-rose-200 bg-surface p-4 flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="font-bold text-sm text-ink">1. Emergency Storefront Intake Pause</h4>
                  <p className="text-xs muted">
                    Temporarily stop all public web reservations across all dates during harvest emergencies or storms.
                  </p>
                </div>
                <span className={`font-bold text-xs px-3 py-1 rounded-full border ${shopData.active ? "bg-emerald-100 text-emerald-900 border-emerald-300" : "bg-rose-100 text-rose-900 border-rose-300"}`}>
                  {shopData.active ? "🟢 Intake Open" : "🔴 INTAKE PAUSED"}
                </span>
              </div>

              {canManageSettings && (
                <div>
                  <button
                    type="button"
                    className={`btn text-xs font-bold ${shopData.active ? "btn-danger" : "btn-primary"}`}
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
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Floating Dirty-State Save Bar */}
      {isDirty && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 rounded-xl bg-slate-900 px-6 py-3 text-white shadow-2xl animate-bounce">
          <span className="text-xs font-semibold">⚠️ You have unsaved changes in Settings.</span>
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
