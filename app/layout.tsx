import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Project Site Diary",
  description: "A private diary for construction site progress.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-AU">
      <body className="bg-stone-100 text-stone-950 antialiased">{children}</body>
    </html>
  );
}
