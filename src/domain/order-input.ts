import { z } from "zod";

export const orderInputSchema = z
  .object({
    locale: z.enum(["fi", "en"]),
    productId: z.string().min(1).max(100),
    packageId: z.string().min(1).max(100),
    quantity: z.number().int().min(1).max(100),
    fulfillmentDate: z.iso.date(),
    fulfillmentMethod: z.enum(["PICKUP", "DELIVERY"]),
    customerName: z.string().trim().min(2).max(120),
    mobile: z.string().trim().min(7).max(30),
    email: z.union([z.email().max(254), z.literal("")]).optional(),
    streetAddress: z.string().trim().max(160).optional(),
    postalCode: z.string().trim().max(10).optional(),
    city: z.string().trim().max(100).optional(),
    notes: z.string().trim().max(1000).optional(),
    marketingConsent: z.boolean().optional(),
    idempotencyKey: z.string().min(16).max(100),
  })
  .superRefine((input, ctx) => {
    if (input.fulfillmentMethod === "DELIVERY") {
      if (!input.streetAddress || input.streetAddress.length < 2) {
        ctx.addIssue({ code: "custom", path: ["streetAddress"], message: "REQUIRED" });
      }
      if (input.postalCode && !/^\d{5}$/.test(input.postalCode)) {
        ctx.addIssue({ code: "custom", path: ["postalCode"], message: "INVALID_POSTAL_CODE" });
      }
    }
  });

export type OrderInput = z.infer<typeof orderInputSchema>;

export function normalizeMobile(value: string) {
  const compact = value.replace(/[\s()-]/g, "");
  const normalized = compact.startsWith("0") ? `+358${compact.slice(1)}` : compact;
  if (!/^\+[1-9]\d{6,14}$/.test(normalized)) {
    throw new Error("INVALID_PHONE");
  }
  return normalized;
}
