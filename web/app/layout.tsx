import type { Metadata } from "next";
import "./globals.css";
import { ArchiveBanner } from "@/components/archive-banner";

export const metadata: Metadata = {
  title: "prd to prod",
  description:
    "Autonomous software delivery pipeline. Brief in. Production out.",
  // Archived site: keep out of search indexes.
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ArchiveBanner />
        {children}
      </body>
    </html>
  );
}
