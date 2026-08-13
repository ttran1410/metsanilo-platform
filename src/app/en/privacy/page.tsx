import type { Metadata } from "next";
import { PrivacyNotice } from "@/app/privacy-notice";

export const metadata: Metadata = { title: "Privacy notice | METSÄNILO" };

export default function EnglishPrivacyNoticePage() {
  return <PrivacyNotice locale="en" />;
}
