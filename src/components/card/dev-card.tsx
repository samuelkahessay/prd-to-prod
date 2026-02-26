"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import type { DevCardData } from "@/data/types";

interface DevCardProps {
  data: DevCardData;
  theme?: string;
}

export default function DevCard({ data, theme = "midnight" }: DevCardProps) {
  const { user } = data;

  return (
    <div
      data-card-root
      style={{
        width: 400,
        height: 560,
        background: "linear-gradient(135deg, #0f172a, #1e293b)",
        borderRadius: "1rem",
        overflow: "hidden",
        color: "#ffffff",
        display: "flex",
        flexDirection: "column",
        padding: "1.5rem",
        boxSizing: "border-box",
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
            border: "2px solid #3b82f6",
          }}
        />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: "bold", fontSize: "1.25rem" }}>{user.name ?? user.login}</div>
          <div style={{ color: "#94a3b8", fontSize: "0.875rem" }}>@{user.login}</div>
        </div>

        {user.bio && (
          <div
            style={{
              color: "#cbd5e1",
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
          <div style={{ display: "flex", gap: "1rem", fontSize: "0.75rem", color: "#94a3b8" }}>
            {user.location && <span>📍 {user.location}</span>}
            {user.company && <span>🏢 {user.company}</span>}
          </div>
        )}

        {/* Stats Row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          style={{ display: "flex", gap: "0.5rem", fontSize: "0.75rem", color: "#94a3b8" }}
        >
          <span>{user.publicRepos} repos</span>
          <span>|</span>
          <span>{user.followers} followers</span>
          <span>|</span>
          <span>{user.following} following</span>
        </motion.div>
      </motion.div>

      {/* Language Bar Placeholder */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        style={{ marginTop: "1rem" }}
      />

      {/* Top Repos Placeholder */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        style={{ marginTop: "1rem" }}
      />
    </div>
  );
}
