export type AdminProductSeason = {
  id: string;
  productId: string;
  nameFi: string;
  nameEn: string;
  startDate: string;
  endDate: string;
  status: "UPCOMING" | "ACTIVE" | "PAUSED" | "COMPLETED";
  targetVolumeMl?: number | null;
  notes?: string | null;
};
