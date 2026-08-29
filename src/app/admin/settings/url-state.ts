export type SettingsSection = "identity" | "fulfillment" | "payments" | "channels" | "storefront" | "themes" | "danger";

export function parseSettingsUrlState(params: URLSearchParams): SettingsSection {
  const section = params.get("section");
  return section === "fulfillment" || section === "payments" || section === "channels" || section === "storefront" || section === "themes" || section === "danger" ? section : "identity";
}

export function serializeSettingsUrlState(current: URLSearchParams, section: SettingsSection) {
  const next = new URLSearchParams(current.toString());
  next.delete("_rsc");
  section === "identity" ? next.delete("section") : next.set("section", section);
  return next;
}
