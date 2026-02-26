"use client";

import { useState } from "react";
import { exportCardAsPng } from "@/lib/export";

interface ExportButtonProps {
  username: string;
  accentColor: string;
}

export default function ExportButton({ username, accentColor }: ExportButtonProps) {
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleDownload() {
    const el = document.querySelector("[data-card-root]") as HTMLElement | null;
    if (!el) return;
    setDownloading(true);
    try {
      await exportCardAsPng(el, username);
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 2000);
    } finally {
      setDownloading(false);
    }
  }

  async function handleCopyLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const downloadLabel = downloading ? "Downloading..." : downloaded ? "✓ Downloaded" : "Download PNG";

  return (
    <div className="flex gap-3">
      <button
        onClick={handleDownload}
        disabled={downloading}
        style={{ backgroundColor: accentColor }}
        className="px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-60 transition-opacity"
      >
        {downloadLabel}
      </button>
      <button
        onClick={handleCopyLink}
        className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium transition-colors"
      >
        {copied ? "Copied!" : "Copy Link"}
      </button>
    </div>
  );
}
