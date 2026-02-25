import type { Metadata } from "next";
import "./globals.css";
import NavBar from "@/components/nav-bar";

export const metadata: Metadata = {
  title: "Pipeline Observatory",
  description: "Visualize, replay, and inspect an autonomous AI development pipeline",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="dark bg-gray-950 text-gray-100 min-h-screen font-sans">
        <NavBar />
        <main>{children}</main>
      </body>
    </html>
  );
}
