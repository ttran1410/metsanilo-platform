import { describe, expect, it } from "vitest";
import { parseJson } from "@/app/api/admin/module";
import { PUT as updatePaymentMethod } from "@/app/api/admin/payment-methods/[method]/route";
import { PATCH as updateFulfillmentLocation } from "@/app/api/admin/fulfillment-locations/[id]/route";
import { DELETE as deletePaymentMethod } from "@/app/api/admin/payment-methods/route";
import { DELETE as deleteFulfillmentLocation } from "@/app/api/admin/fulfillment-locations/route";

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
    expect(payment.headers.get("content-type")).toContain("application/json");
    expect(fulfillment.headers.get("content-type")).toContain("application/json");
    expect((await payment.json())).toMatchObject({ code: "VALIDATION_ERROR", correlationId: expect.any(String) });
    expect((await fulfillment.json())).toMatchObject({ code: "VALIDATION_ERROR", correlationId: expect.any(String) });
  });

  it("keeps canonical DELETE requests behind authentication", async () => {
    const payment = await deletePaymentMethod(new Request("http://localhost/api/admin/payment-methods", { method: "DELETE" }));
    const fulfillment = await deleteFulfillmentLocation(new Request("http://localhost/api/admin/fulfillment-locations", { method: "DELETE" }));
    expect(payment.status).toBe(401);
    expect(fulfillment.status).toBe(401);
    expect(await payment.json()).toMatchObject({ code: "UNAUTHORIZED", correlationId: expect.any(String) });
    expect(await fulfillment.json()).toMatchObject({ code: "UNAUTHORIZED", correlationId: expect.any(String) });
  });
});
