import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Project Site Diary",
  description: "A private diary for construction site progress.",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Site Diary", statusBarStyle: "default" },
  icons: { apple: "/icons/diary-192.png" },
};

export const viewport: Viewport = { themeColor: "#f5f2ec" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-AU">
      <body className="antialiased">{children}</body>
    </html>
  );
}
