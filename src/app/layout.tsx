import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

const description = "Käsin poimittuja ja huolellisesti puhdistettuja metsämustikoita Satakunnasta.";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || requestHeaders.get("host") || "localhost:3000";
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProtocol || (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const socialImage = `${origin}/og.png`;

  return {
    metadataBase: new URL(origin),
    title: "METSÄNILO — Metsän maku, talteen kesästä",
    description,
    icons: {
      icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
      shortcut: "/icon.svg",
      apple: "/icon.svg",
    },
    openGraph: {
      type: "website",
      title: "METSÄNILO",
      description,
      images: [{ url: socialImage, width: 1200, height: 630, alt: "METSÄNILO — Metsän maku, talteen kesästä." }],
    },
    twitter: {
      card: "summary_large_image",
      title: "METSÄNILO",
      description,
      images: [socialImage],
    },
  };
}

export const viewport = { themeColor: "#17372B", colorScheme: "light" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fi">
      <body>{children}</body>
    </html>
  );
}
