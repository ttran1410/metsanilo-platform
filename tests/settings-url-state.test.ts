import { describe, expect, it } from "vitest";
import { parseSettingsUrlState, serializeSettingsUrlState } from "@/app/admin/settings-url-state";

describe("Settings URL state", () => {
  it("parses a shareable settings section", () => {
    expect(parseSettingsUrlState(new URLSearchParams("section=payments"))).toBe("payments");
  });

  it("falls back to identity for unsupported sections", () => {
    expect(parseSettingsUrlState(new URLSearchParams("section=unknown"))).toBe("identity");
  });

  it("preserves unrelated params and removes the default section", () => {
    const next = serializeSettingsUrlState(new URLSearchParams("created=1&notice=saved"), "identity");
    expect(next.get("created")).toBe("1");
    expect(next.get("notice")).toBe("saved");
    expect(next.has("section")).toBe(false);
    expect(serializeSettingsUrlState(next, "themes").get("section")).toBe("themes");
  });
});
