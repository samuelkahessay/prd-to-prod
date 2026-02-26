"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import DevCard from "@/components/card/dev-card";
import ThemeSelector from "@/components/card/theme-selector";
import ExportButton from "@/components/card/export-button";
import { THEMES } from "@/data/themes";
import type { DevCardData } from "@/data/types";

interface CardViewProps {
  data: DevCardData;
  username: string;
}

export default function CardView({ data, username }: CardViewProps) {
  const [theme, setTheme] = useState("midnight");
  const currentTheme = THEMES.find((t) => t.id === theme) ?? THEMES[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center gap-4"
    >
      <DevCard data={data} theme={theme} />
      <ThemeSelector currentTheme={theme} onChange={setTheme} />
      <ExportButton username={username} accentColor={currentTheme.accentColor} />
      <div className="text-center mt-2">
        <p className="text-gray-400 text-sm mb-1">Share this card</p>
        <input
          type="text"
          readOnly
          value={typeof window !== "undefined" ? window.location.href : `/card/${username}`}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 w-72 text-center outline-none"
        />
      </div>
    </motion.div>
  );
}
