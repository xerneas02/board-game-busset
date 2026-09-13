import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sous l’escalier",
  description: "Notre ludothèque familiale",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Nos jeux" },
  icons: { icon: "/icon.svg", apple: "/icon-192.png" },
};

export const viewport: Viewport = { themeColor: "#442b1e", width: "device-width", initialScale: 1 };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="fr"><body>{children}</body></html>;
}
