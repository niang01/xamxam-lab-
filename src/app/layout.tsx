import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "@/components/providers";
import { LabShell } from "@/components/LabShell";

export const metadata: Metadata = {
  title: { default: "XAM-XAM LAB", template: "%s · XAM-XAM LAB" },
  description: "Global AI Engineering, Simulation, Innovation & Startup Ecosystem — de l'idée à la conception, de la conception à la simulation, de la simulation à la réalisation.",
  applicationName: "XAM-XAM LAB",
  appleWebApp: { capable: true, title: "XAM-XAM LAB", statusBarStyle: "black-translucent" },
  icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/favicon.ico", sizes: "16x16 32x32 48x48" }], apple: "/apple-touch-icon.png" },
};

/** Thème choisi (sombre par défaut), appliqué avant le premier rendu pour éviter un flash. */
const THEME_BOOT = `try{var t=localStorage.getItem("xx-theme");document.documentElement.dataset.theme=t==="light"||t==="system"?t:"dark"}catch(e){document.documentElement.dataset.theme="dark"}`;

export const viewport: Viewport = { themeColor: "#080d1b", width: "device-width", initialScale: 1 };

export default function XamXamRoot({ children }: { children: ReactNode }) {
  return (
    <html lang="wo" data-theme="dark" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} /></head>
      <body className="min-h-dvh antialiased">
        <Providers><LabShell>{children}</LabShell></Providers>
      </body>
    </html>
  );
}
