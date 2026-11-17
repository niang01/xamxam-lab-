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
};

export const viewport: Viewport = { themeColor: "#05070d", width: "device-width", initialScale: 1 };

export default function XamXamRoot({ children }: { children: ReactNode }) {
  return (
    <html lang="wo" suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <Providers><LabShell>{children}</LabShell></Providers>
      </body>
    </html>
  );
}
