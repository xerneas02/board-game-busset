import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sous l’escalier",
  description: "Notre ludothèque familiale",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Nos jeux", statusBarStyle: "default" },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport: Viewport = { themeColor: "#f5ecdc", colorScheme: "light", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="fr"><body>{children}</body></html>;
}
