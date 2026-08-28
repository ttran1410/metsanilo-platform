import { describe, expect, it } from "vitest";
import { parseJson } from "@/app/api/admin/module";
import { PUT as updatePaymentMethod } from "@/app/api/admin/payment-methods/[method]/route";
import { PATCH as updateFulfillmentLocation } from "@/app/api/admin/fulfillment-locations/[id]/route";

describe("admin request module contract", () => {
  it("parses valid JSON bodies", async () => {
    await expect(parseJson(new Request("http://localhost", { method: "POST", body: JSON.stringify({ action: "update" }) }))).resolves.toEqual({ action: "update" });
  });

  it("turns malformed JSON into a validation error", async () => {
    await expect(parseJson(new Request("http://localhost", { method: "POST", body: "{" }))).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 422 });
  });

  it("keeps compatibility member routes on the JSON error envelope", async () => {
    const payment = await updatePaymentMethod(new Request("http://localhost/api/admin/payment-methods/CASH", { method: "PUT", body: "{" }), { params: Promise.resolve({ method: "CASH" }) });
    const fulfillment = await updateFulfillmentLocation(new Request("http://localhost/api/admin/fulfillment-locations/location-1", { method: "PATCH", body: "{" }), { params: Promise.resolve({ id: "location-1" }) });
    expect(payment.status).toBe(422);
    expect(fulfillment.status).toBe(422);
    expect((await payment.json()).code).toBe("VALIDATION_ERROR");
    expect((await fulfillment.json()).code).toBe("VALIDATION_ERROR");
  });
});
