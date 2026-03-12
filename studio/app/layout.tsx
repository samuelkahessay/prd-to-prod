import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "prd-to-prod",
  description:
    "Autonomous software delivery pipeline. Brief in. Production out.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
