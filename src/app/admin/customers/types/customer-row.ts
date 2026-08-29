export type CustomerRow = {
  id: string; name: string; mobile: string | null; email?: string | null; matchStatus: string;
  marketingConsent: boolean; marketingConsentStatus: string; marketingConsentAt?: string | null;
  marketingConsentSource?: string | null; marketingConsentUpdatedBy?: string | null; notes?: string | null;
  facebookProfile?: string | null; contactConfirmationExpiresAt?: string | null; contactConfirmedAt?: string | null;
  contactConfirmedBy?: string | null; contactConfirmationChannel?: string | null; retentionHoldUntil?: string | null;
  retentionHoldReason?: string | null; updatedAt: string;
  metrics?: { totalOrders: number; completedOrders: number; noShowCount: number; reliabilityRatePercent: number; lifetimeLitres: number; totalSpendCents: number; lastFulfillmentDate: string | null; isVip: boolean; preferredMethod: "PICKUP" | "DELIVERY"; reviewCount?: number; averageRating?: number | null; primaryAddress?: string | null };
};
