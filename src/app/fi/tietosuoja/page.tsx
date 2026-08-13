import type { Metadata } from "next";
import { PrivacyNotice } from "@/app/privacy-notice";

export const metadata: Metadata = { title: "Tietosuojaseloste | METSÄNILO" };

export default function FinnishPrivacyNoticePage() {
  return <PrivacyNotice locale="fi" />;
}
