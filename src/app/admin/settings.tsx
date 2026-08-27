"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Building2, CreditCard, ExternalLink, Image as ImageIcon, Inbox, LoaderCircle, LockKeyhole, MapPin, Palette, Pause, Phone, Play, Plus, Save, ShieldAlert, Store, Trash2, UploadCloud, type LucideIcon } from "lucide-react";
import { AdminConfirmDialog, AdminNotice, AdminPageHeader } from "./presentation";
import { StorefrontThemeManager } from "./storefront-theme-manager";
import { SettingsSectionTabs } from "./settings-section-tabs";

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
  sameDayCutoffEnabled: boolean;
  sameDayCutoffTime: string;
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

type Section = "identity" | "fulfillment" | "payments" | "channels" | "storefront" | "themes" | "danger";

function ImageDropzone({
  label,
  description,
  currentUrl,
  defaultFallbackUrl = "/metsanilo-leaf.svg",
  onUpload,
  onRemove,
  isUploading,
  disabled,
}: {
  label: string;
  description: string;
  currentUrl?: string | null;
  defaultFallbackUrl?: string;
  onUpload: (file: File, altFi: string, altEn: string) => Promise<void>;
  onRemove?: () => Promise<void>;
  isUploading?: boolean;
  disabled?: boolean;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [altFi, setAltFi] = useState("");
  const [altEn, setAltEn] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const displayUrl = currentUrl || defaultFallbackUrl;

  async function handleFileSelected(file: File) {
    if (!file || disabled) return;
    await onUpload(file, altFi || label, altEn || label);
  }

  return (
    <div className="settings-asset-card">
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
            <Trash2 aria-hidden="true" /> Remove custom asset
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
        <div className="settings-asset-preview">
          <div className="w-20 h-20 relative flex items-center justify-center rounded-xl overflow-hidden bg-surface border border-line p-2 shadow-2xs">
            <img src={displayUrl} alt={label} className="max-w-full max-h-full object-contain" />
          </div>
          <span className="text-[10px] font-bold text-ink/70 mt-1.5 truncate max-w-[140px]">
            {currentUrl ? "Custom asset active" : "Default brand asset"}
          </span>
        </div>

        {!disabled && (
          <>
          <input
            ref={inputRef}
            className="sr-only"
            type="file"
            accept="image/png,image/svg+xml,image/webp,image/x-icon,image/jpeg"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFileSelected(file);
            }}
          />
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
            className={`settings-dropzone ${
              isDragOver ? "border-primary bg-primary/5" : "border-line hover:border-primary/50 hover:bg-surface-muted/30"
            }`}
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
            }}
          >
            {isUploading ? <LoaderCircle className="settings-upload-spinner" aria-hidden="true" /> : <UploadCloud aria-hidden="true" />}
            <p className="text-xs font-bold text-ink">
              {isUploading ? "Uploading asset…" : "Drop an image or choose a file"}
            </p>
            <p className="text-[11px] muted mt-0.5">PNG, SVG, WebP, ICO or JPEG · maximum 2 MB</p>
          </div>
          </>
        )}
      </div>
      {!disabled && (
        <div className="settings-alt-grid">
          <label className="field"><span>Alternative text (FI)</span><input value={altFi} onChange={(event) => setAltFi(event.target.value)} placeholder={`${label} suomeksi`} /></label>
          <label className="field"><span>Alternative text (EN)</span><input value={altEn} onChange={(event) => setAltEn(event.target.value)} placeholder={label} /></label>
        </div>
      )}
    </div>
  );
}

export function OperationsSettings({ canManageSettings, canManageTheme }: { canManageSettings: boolean; canManageTheme: boolean }) {
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
    sameDayCutoffEnabled: false,
    sameDayCutoffTime: "15:00",
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

  const [shopDirty, setShopDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"success" | "error">("success");
  const [uploadingPageKey, setUploadingPageKey] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ title: string; description: string; confirmLabel?: string; destructive?: boolean; onConfirm: () => Promise<void> } | null>(null);

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

      setShopDirty(false);
    } catch (error) {
      feedback(error instanceof Error ? error.message : "Settings unavailable", "error");
    }
  }

  useEffect(() => {
    // Load all settings once after the client workspace mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save Shop Identity & Contact
  async function saveShopIdentity(event?: FormEvent, nextShopData: ShopIdentity = shopData) {
    if (event) event.preventDefault();
    try {
      const updated = await request("/api/admin/contact", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(nextShopData),
      });
      setShopData(updated);
      setShopDirty(false);
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
    setConfirmation({ title: "Delete fulfillment location?", description: "This can affect pickup and delivery operations. Review dependencies before continuing.", confirmLabel: "Delete location", destructive: true, onConfirm: async () => {
      try { await request(`/api/admin/fulfillment-locations?id=${id}`, { method: "DELETE" }); feedback("Fulfillment location deleted.", "success"); await loadAll(); }
      catch (error) { feedback(error instanceof Error ? error.message : "Could not delete location", "error"); }
    } });
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
    setConfirmation({ title: "Delete custom payment method?", description: `Remove '${methodKey}' from the shop configuration? Existing orders and audit history are preserved.`, confirmLabel: "Delete method", destructive: true, onConfirm: async () => {
      try { await request(`/api/admin/payment-methods?method=${methodKey}`, { method: "DELETE" }); feedback("Payment method deleted.", "success"); await loadAll(); }
      catch (error) { feedback(error instanceof Error ? error.message : "Could not delete payment method", "error"); }
    } });
  }

  // Save Order Source
  async function saveSource(event: FormEvent<HTMLFormElement>, source: Source) {
    event.preventDefault();
    try {
      const values = new FormData(event.currentTarget);
      const data = await request(`/api/admin/order-sources/${source.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          key: values.get("key"),
          labelFi: values.get("labelFi"),
          labelEn: values.get("labelEn"),
          sortOrder: Number(values.get("sortOrder")),
          active: values.get("active") === "on",
        }),
      });
      setSources((rows) => rows.map((row) => (row.id === source.id ? data : row)));
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
    setConfirmation({ title: "Delete intake channel?", description: "New orders will no longer be able to use this channel. Existing orders are not changed.", confirmLabel: "Delete channel", destructive: true, onConfirm: async () => {
      try { await request(`/api/admin/order-sources/${id}`, { method: "DELETE" }); feedback("Order intake channel deleted.", "success"); await loadAll(); }
      catch (error) { feedback(error instanceof Error ? error.message : "Could not delete channel", "error"); }
    } });
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

  const sections: { id: Section; label: string; icon: LucideIcon; desc: string }[] = [
    { id: "identity", label: "Shop identity", icon: Building2, desc: "Branding, logo and contact details" },
    { id: "fulfillment", label: "Fulfillment hubs", icon: MapPin, desc: "Pickup locations and directions" },
    { id: "payments", label: "Payment methods", icon: CreditCard, desc: "Payment guidance and instructions" },
    { id: "channels", label: "Order channels", icon: Inbox, desc: "Intake sources and attribution" },
    { id: "storefront", label: "Storefront & media", icon: ImageIcon, desc: "Page visibility and managed imagery" },
    { id: "themes", label: "Frontstore themes", icon: Palette, desc: "Draft, preview and publish" },
    { id: "danger", label: "System & safety", icon: ShieldAlert, desc: "Emergency intake controls" },
  ];

  return (
    <section className="admin-settings-workspace shell pb-20 flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <AdminPageHeader
          eyebrow="Administration"
          title="Settings"
          description="Manage shop operations and customer-facing configuration by domain. Each section saves independently."
        />
        <Link
          href="/fi"
          target="_blank"
          className="btn btn-secondary text-xs font-bold flex items-center gap-1.5 shadow-2xs"
        >
           <span>View live storefront</span>
          <ExternalLink aria-hidden="true" />
        </Link>
      </div>

      {message && <AdminNotice tone={tone} live>{message}</AdminNotice>}
      {!canManageSettings && (
        <AdminNotice tone="success" live>
          Read-only access. An administrator or manager must change operational settings.
        </AdminNotice>
      )}

      <SettingsSectionTabs>
        {sections.map((sec) => {
          const active = activeSection === sec.id;
          const Icon = sec.icon;
          return (
            <button
              key={sec.id}
              type="button"
              onClick={() => setActiveSection(sec.id)}
              aria-current={active ? "page" : undefined}
              title={sec.desc}
              className={`settings-section-tab ${
                active
                  ? "bg-surface text-primary shadow-xs border border-line"
                  : "text-muted hover:text-ink hover:bg-surface/50"
              }`}
            >
              <Icon aria-hidden="true" />
              <span>{sec.label}</span>
            </button>
          );
        })}
      </SettingsSectionTabs>

      <main className="flex flex-col gap-6">
        {activeSection === "identity" && (
          <div className="flex flex-col gap-6">
            <form
              className="card p-5 grid gap-4 border border-line"
              onSubmit={(e) => void saveShopIdentity(e)}
              onChange={() => setShopDirty(true)}
            >
              <div className="settings-section-heading">
                <span className="admin-section-icon" aria-hidden="true"><Building2 /></span>
                <div>
                <h3 className="font-bold text-lg text-ink">Shop identity and legal details</h3>
                <p className="text-xs muted">
                  Public brand names, legal identity and customer contact details.
                </p>
                </div>
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

              <div className="settings-subheading">
                <Phone aria-hidden="true" />
                <div><h4 className="font-bold text-sm text-ink">Customer contact</h4>
                <p className="text-xs muted">Shown on storefront, receipts, and order confirmation messages.</p>
                </div>
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
                    <Save aria-hidden="true" /> Save identity and contact
                  </button>
                </div>
              )}
            </form>

            <div className="flex flex-col gap-4">
              <div className="settings-section-heading">
                <span className="admin-section-icon" aria-hidden="true"><ImageIcon /></span>
                <div><h3 className="font-bold text-base text-ink">Brand assets</h3>
                <p className="text-xs muted">
                  Upload the storefront header mark and browser icon. The Metsänilo leaf remains the fallback.
                </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <ImageDropzone
                  label="Brand Header Logo"
                  description="Main logo displayed on storefront header lockup & receipts."
                  currentUrl={logoMedia[0]?.url || shopData.logoUrl}
                  defaultFallbackUrl="/metsanilo-leaf.svg"
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
                  onUpload={(file, altFi, altEn) => handleMediaUpload("favicon", file, altFi, altEn)}
                  onRemove={faviconMedia[0] ? () => deleteMediaAttachmentItem(faviconMedia[0].attachmentId!, "favicon") : undefined}
                  isUploading={uploadingPageKey === "favicon"}
                  disabled={!canManageSettings}
                />
              </div>
            </div>
          </div>
        )}

        {activeSection === "fulfillment" && (
          <div className="card p-5 flex flex-col gap-4 border border-line">
            <div className="settings-section-heading">
              <span className="admin-section-icon" aria-hidden="true"><MapPin /></span>
              <div><h3 className="font-bold text-lg text-ink">Fulfilment locations</h3>
              <p className="text-xs muted">
                Manage customer pickup points and delivery dispatch origins.
              </p>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {locations.map((loc) => (
                <form
                  key={loc.id}
                  className="grid gap-3 rounded-xl border border-line bg-surface-muted/30 p-4"
                  onSubmit={(e) => void saveLocation(e, loc)}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-ink">
                        {loc.type === "PICKUP" ? "Pickup location" : "Delivery dispatch origin"}
                      </span>
                      {loc.isDefault && (
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-900 border border-amber-300">
                          Default for type
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
                        Preview on Maps <ExternalLink aria-hidden="true" />
                      </a>

                      {!loc.isDefault && canManageSettings && (
                        <button
                          type="button"
                          className="btn btn-secondary text-xs text-danger py-1 px-2 font-bold"
                          onClick={() => void deleteLocationItem(loc.id)}
                        >
                          <Trash2 aria-hidden="true" /> Delete
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
                <h4 className="font-bold text-xs text-ink uppercase tracking-wider"><Plus aria-hidden="true" /> Add fulfilment location</h4>
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
            <div className="settings-section-heading">
              <span className="admin-section-icon" aria-hidden="true"><CreditCard /></span>
              <div>
              <h3 className="font-bold text-lg text-ink">Payment methods</h3>
              <p className="text-xs muted">
                Enable methods and maintain customer instructions. Changes are saved explicitly per method.
              </p>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {methods.map((method) => {
                const isSystemDefault = ["CASH", "BANK_TRANSFER", "MOBILEPAY"].includes(method.method);

                return (
                  <form key={method.method} className="settings-record-card" onSubmit={(event) => { event.preventDefault(); void savePaymentMethod(method); }}>
                    <div className="flex items-center justify-between border-b border-line pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-ink">
                          {method.method === "MOBILEPAY"
                            ? "MobilePay"
                            : method.method === "CASH"
                            ? "Cash at pickup"
                            : method.method === "CARD"
                            ? "Card at pickup"
                            : method.method === "BANK_TRANSFER"
                            ? "Bank transfer"
                            : method.method}
                        </span>
                        {isSystemDefault ? (
                          <span className="admin-status-badge admin-status-neutral">
                            <LockKeyhole aria-hidden="true" /> System method
                          </span>
                        ) : (
                          <span className="admin-status-badge admin-status-success">
                            Custom method
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 font-bold text-xs">
                          <span>{method.enabled ? "Enabled" : "Disabled"}</span>
                          <input
                            type="checkbox"
                            checked={method.enabled}
                            disabled={!canManageSettings}
                            onChange={(event) => setMethods((rows) => rows.map((row) => row.method === method.method ? { ...row, enabled: event.target.checked } : row))}
                          />
                        </label>

                        {!isSystemDefault && canManageSettings && (
                          <button
                            type="button"
                            className="btn btn-secondary text-xs text-danger font-bold py-1 px-2"
                            onClick={() => void deletePaymentMethodItem(method.method)}
                          >
                            <Trash2 aria-hidden="true" /> Delete
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-2 md:grid-cols-2">
                      <label className="field">
                        <span className="font-semibold text-xs text-ink">Customer Instruction Note (FI)</span>
                        <input
                          value={method.instructionsFi ?? ""}
                          placeholder={
                            method.method === "MOBILEPAY"
                              ? "Maksu noudettaessa MobilePaylla numeroon 89123."
                              : "Ohje asiakkaalle..."
                          }
                          disabled={!canManageSettings}
                          onChange={(event) => setMethods((rows) => rows.map((row) => row.method === method.method ? { ...row, instructionsFi: event.target.value } : row))}
                        />
                      </label>
                      <label className="field">
                        <span className="font-semibold text-xs text-ink">Customer Instruction Note (EN)</span>
                        <input
                          value={method.instructionsEn ?? ""}
                          placeholder={
                            method.method === "MOBILEPAY"
                              ? "Pay via MobilePay to number 89123 at pickup."
                              : "Instructions for customer..."
                          }
                          disabled={!canManageSettings}
                          onChange={(event) => setMethods((rows) => rows.map((row) => row.method === method.method ? { ...row, instructionsEn: event.target.value } : row))}
                        />
                      </label>
                    </div>
                    {canManageSettings && <div className="settings-record-actions"><button type="submit" className="btn"><Save aria-hidden="true" />Save method</button></div>}
                  </form>
                );
              })}
            </div>
          </div>
        )}

        {activeSection === "channels" && (
          <div className="card p-5 flex flex-col gap-4 border border-line">
            <div className="settings-section-heading">
              <span className="admin-section-icon" aria-hidden="true"><Inbox /></span>
              <div><h3 className="font-bold text-lg text-ink">Order intake channels</h3>
              <p className="text-xs muted">
                Maintain attribution labels and ordering. Core channels are protected from deletion.
              </p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {sources.map((source) => {
                const isCoreChannel = ["WEBSITE", "MANUAL", "HISTORICAL"].includes(source.key);

                return (
                  <form
                    key={source.id}
                    className="grid gap-2 rounded-xl border border-line p-3 md:grid-cols-6 items-center bg-surface-muted/20"
                    onSubmit={(e) => void saveSource(e, source)}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <input name="key" defaultValue={source.key} disabled={!canManageSettings || isCoreChannel} required className="text-xs font-mono font-bold" />
                      {isCoreChannel && (
                        <span title="System core channel" className="settings-lock-icon"><LockKeyhole aria-hidden="true" /></span>
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
                          <Trash2 aria-hidden="true" /><span className="sr-only">Delete {source.labelEn}</span>
                        </button>
                      )}
                    </div>
                  </form>
                );
              })}
            </div>

            {canManageSettings && (
              <form className="rounded-xl border border-dashed border-line p-4 flex flex-col gap-3 mt-2" onSubmit={(e) => void addSource(e)}>
                <h4 className="font-bold text-xs text-ink uppercase tracking-wider"><Plus aria-hidden="true" /> Add custom order channel</h4>
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

        {activeSection === "storefront" && (
          <div className="flex flex-col gap-6">
            <form
              className="card p-5 flex flex-col gap-4 border border-line"
              onSubmit={(e) => void saveShopIdentity(e)}
              onChange={() => setShopDirty(true)}
            >
              <div className="settings-section-heading">
                <span className="admin-section-icon" aria-hidden="true"><Store /></span>
                <div><h3 className="font-bold text-lg text-ink">Storefront page visibility</h3>
                <p className="text-xs muted">
                  Control active storefront pages. Disabling a page hides its link from navigation menus and returns 404 on direct access.
                </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {/* How it works toggle */}
                <div className="rounded-xl border border-line p-4 flex flex-col gap-2 bg-surface-muted/30">
                  <span className="font-bold text-xs text-ink">How it works</span>
                  <label className="flex items-center justify-between text-xs font-bold">
                    <span>{shopData.howItWorksVisible ? "Visible" : "Hidden · 404"}</span>
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
                  <span className="font-bold text-xs text-ink">Reviews</span>
                  <label className="flex items-center justify-between text-xs font-bold">
                    <span>{shopData.reviewsVisible ? "Visible" : "Hidden · 404"}</span>
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
                  <span className="font-bold text-xs text-ink">About us</span>
                  <label className="flex items-center justify-between text-xs font-bold">
                    <span>{shopData.aboutUsVisible ? "Visible" : "Hidden · 404"}</span>
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
                    <Save aria-hidden="true" /> Save page visibility
                  </button>
                </div>
              )}
            </form>

            <div className="card p-5 flex flex-col gap-5 border border-line">
              <div className="settings-section-heading">
                <span className="admin-section-icon" aria-hidden="true"><ImageIcon /></span>
                <div><h3 className="font-bold text-lg text-ink">Storefront media</h3>
                <p className="text-xs muted">
                  Upload managed imagery for the homepage hero, How it works and About us.
                </p>
                </div>
              </div>

              <ImageDropzone
                label="Homepage Hero Banner"
                description="Hero banner image for storefront homepage."
                currentUrl={heroMedia[0]?.url}
                defaultFallbackUrl="/metsanilo-leaf.svg"
                onUpload={(file, altFi, altEn) => handleMediaUpload("hero", file, altFi, altEn)}
                onRemove={heroMedia[0] ? () => deleteMediaAttachmentItem(heroMedia[0].attachmentId!, "hero") : undefined}
                isUploading={uploadingPageKey === "hero"}
                disabled={!canManageSettings}
              />

              <ImageDropzone
                label="How It Works Process Media"
                description="Process step diagrams and illustrations."
                currentUrl={howMedia[0]?.url}
                defaultFallbackUrl="/metsanilo-leaf.svg"
                onUpload={(file, altFi, altEn) => handleMediaUpload("how-it-works", file, altFi, altEn)}
                onRemove={howMedia[0] ? () => deleteMediaAttachmentItem(howMedia[0].attachmentId!, "how-it-works") : undefined}
                isUploading={uploadingPageKey === "how-it-works"}
                disabled={!canManageSettings}
              />

              <ImageDropzone
                label="About Us Story & Forest Media"
                description="Forest harvest photos for brand story page."
                currentUrl={aboutMedia[0]?.url}
                defaultFallbackUrl="/metsanilo-leaf.svg"
                onUpload={(file, altFi, altEn) => handleMediaUpload("about-us", file, altFi, altEn)}
                onRemove={aboutMedia[0] ? () => deleteMediaAttachmentItem(aboutMedia[0].attachmentId!, "about-us") : undefined}
                isUploading={uploadingPageKey === "about-us"}
                disabled={!canManageSettings}
              />
            </div>
          </div>
        )}

        {activeSection === "themes" && <StorefrontThemeManager canManageTheme={canManageTheme} />}

        {activeSection === "danger" && (
          <div className="card p-5 flex flex-col gap-4 border border-rose-200 bg-rose-50/20">
            <div className="settings-section-heading">
              <span className="admin-section-icon settings-section-icon-danger" aria-hidden="true"><ShieldAlert /></span>
              <div><h3 className="font-bold text-lg text-rose-900">System safety</h3>
              <p className="text-xs text-rose-800 font-medium">
                Emergency controls that immediately affect the public ordering path.
              </p>
              </div>
            </div>

            <div className="rounded-xl border border-rose-200 bg-surface p-4 flex flex-col gap-3">
              <div className="rounded-xl border border-line bg-surface-muted p-4 flex flex-col gap-3">
                <div>
                  <h4 className="font-bold text-sm text-ink">Same-day reservation cutoff</h4>
                  <p className="text-xs muted">Apply one local cutoff to pickup and home delivery. Future dates remain available.</p>
                </div>
                <label className="field-checkbox"><input type="checkbox" checked={shopData.sameDayCutoffEnabled} disabled={!canManageSettings} onChange={(e) => setShopData({ ...shopData, sameDayCutoffEnabled: e.target.checked })} /><span>Enable same-day reservation cutoff</span></label>
                <label className="field"><span>Cutoff time (Europe/Helsinki)</span><input type="time" value={shopData.sameDayCutoffTime} disabled={!canManageSettings || !shopData.sameDayCutoffEnabled} onChange={(e) => setShopData({ ...shopData, sameDayCutoffTime: e.target.value })} /></label>
                {canManageSettings && <button type="button" className="btn btn-secondary self-start" onClick={() => void saveShopIdentity()}><Save aria-hidden="true" />Save cutoff setting</button>}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="font-bold text-sm text-ink">Public reservation intake</h4>
                  <p className="text-xs muted">
                    Temporarily stop all public web reservations across all dates during harvest emergencies or storms.
                  </p>
                </div>
                <span className={`font-bold text-xs px-3 py-1 rounded-full border ${shopData.active ? "bg-emerald-100 text-emerald-900 border-emerald-300" : "bg-rose-100 text-rose-900 border-rose-300"}`}>
                  {shopData.active ? "Intake open" : "Intake paused"}
                </span>
              </div>

              {canManageSettings && (
                <div>
                  <button
                    type="button"
                    className={`btn text-xs font-bold ${shopData.active ? "btn-danger" : "btn-primary"}`}
                    onClick={() => {
                      const nextState = !shopData.active;
                      setConfirmation({ title: `${nextState ? "Resume" : "Pause"} public reservations?`, description: nextState ? "Customers will be able to submit new reservations again." : "Customers will no longer be able to submit new storefront reservations until intake is resumed.", confirmLabel: nextState ? "Resume reservations" : "Pause reservations", destructive: !nextState, onConfirm: async () => { const nextShopData = { ...shopData, active: nextState }; setShopData(nextShopData); await saveShopIdentity(undefined, nextShopData); } });
                    }}
                  >
                    {shopData.active ? <><Pause aria-hidden="true" />Pause public reservations</> : <><Play aria-hidden="true" />Resume public reservations</>}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <AdminConfirmDialog
        open={confirmation !== null}
        title={confirmation?.title ?? "Confirm action"}
        description={confirmation?.description}
        confirmLabel={confirmation?.confirmLabel}
        destructive={confirmation?.destructive}
        onCancel={() => setConfirmation(null)}
        onConfirm={async () => { const action = confirmation?.onConfirm; setConfirmation(null); if (action) await action(); }}
      />

      {/* Floating Dirty-State Save Bar */}
      {shopDirty && (
        <div className="settings-savebar" role="status">
          <span><strong>Unsaved shop settings</strong><small>Save or discard identity and storefront visibility changes.</small></span>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void loadAll()}
          >
            Discard changes
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => void saveShopIdentity()}
          >
            <Save aria-hidden="true" /> Save shop settings
          </button>
        </div>
      )}
    </section>
  );
}
