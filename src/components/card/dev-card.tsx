"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import type { DevCardData } from "@/data/types";
import { THEMES } from "@/data/themes";
import LanguageBar from "@/components/card/language-bar";
import TopRepos from "@/components/card/top-repos";

interface DevCardProps {
  data: DevCardData;
  theme?: string;
}

export default function DevCard({ data, theme = "midnight" }: DevCardProps) {
  const { user, languages, topRepos } = data;
  const activeTheme = THEMES.find((t) => t.id === theme) ?? THEMES[0];
  const isNeon = activeTheme.id === "neon";

  return (
    <div
      data-card-root
      style={{
        width: 400,
        height: 560,
        background: activeTheme.background,
        borderRadius: "1rem",
        overflow: "hidden",
        color: activeTheme.textPrimary,
        display: "flex",
        flexDirection: "column",
        padding: "1.5rem",
        boxSizing: "border-box",
        ...(isNeon ? { boxShadow: activeTheme.borderColor } : {}),
      }}
    >
      {/* Profile Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0 }}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}
      >
        <Image
          src={user.avatarUrl}
          alt={`${user.name ?? user.login}'s avatar`}
          width={96}
          height={96}
          style={{
            borderRadius: "50%",
            border: isNeon ? "1px solid " + activeTheme.accentColor : activeTheme.borderColor,
          }}
        />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: "bold", fontSize: "1.25rem", color: activeTheme.textPrimary }}>
            {user.name ?? user.login}
          </div>
          <div style={{ color: activeTheme.textSecondary, fontSize: "0.875rem" }}>
            @{user.login}
          </div>
        </div>

        {user.bio && (
          <div
            style={{
              color: activeTheme.textSecondary,
              fontSize: "0.875rem",
              textAlign: "center",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {user.bio}
          </div>
        )}

        {(user.location || user.company) && (
          <div
            style={{
              display: "flex",
              gap: "1rem",
              fontSize: "0.75rem",
              color: activeTheme.textSecondary,
            }}
          >
            {user.location && <span>📍 {user.location}</span>}
            {user.company && <span>🏢 {user.company}</span>}
          </div>
        )}

        {/* Stats Row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          style={{
            display: "flex",
            gap: "0.5rem",
            fontSize: "0.75rem",
            color: activeTheme.accentColor,
          }}
        >
          <span>{user.publicRepos} repos</span>
          <span style={{ color: activeTheme.textSecondary }}>|</span>
          <span>{user.followers} followers</span>
          <span style={{ color: activeTheme.textSecondary }}>|</span>
          <span>{user.following} following</span>
        </motion.div>
      </motion.div>

      {/* Language Bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        style={{ marginTop: "1rem" }}
      >
        <LanguageBar languages={languages} />
      </motion.div>

      {/* Top Repos */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        style={{ marginTop: "1rem" }}
      >
        <TopRepos repos={topRepos} />
      </motion.div>
    </div>
  );
}
