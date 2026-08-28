import { describe, expect, it } from "vitest";
import { parseJson } from "@/app/api/admin/module";

describe("admin request module contract", () => {
  it("parses valid JSON bodies", async () => {
    await expect(parseJson(new Request("http://localhost", { method: "POST", body: JSON.stringify({ action: "update" }) }))).resolves.toEqual({ action: "update" });
  });

  it("turns malformed JSON into a validation error", async () => {
    await expect(parseJson(new Request("http://localhost", { method: "POST", body: "{" }))).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 422 });
  });
});
