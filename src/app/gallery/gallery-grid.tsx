"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import DevCard from "@/components/card/dev-card";
import type { DevCardData } from "@/data/types";
import type { GalleryUser } from "@/data/gallery-users";

interface GalleryCardItem {
  user: GalleryUser;
  data: DevCardData;
}

interface GalleryGridProps {
  cards: GalleryCardItem[];
}

export default function GalleryGrid({ cards }: GalleryGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
      {cards.map(({ user, data }, i) => (
        <motion.div
          key={user.username}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
        >
          <Link href={`/card/${user.username}`} className="block">
            <div style={{ width: 300, height: 420, overflow: "hidden", position: "relative" }}>
              <div style={{ transform: "scale(0.75)", transformOrigin: "top left", width: 400, height: 560, flexShrink: 0 }}>
                <DevCard data={data} theme="midnight" />
              </div>
            </div>
          </Link>
          <p className="text-sm text-gray-400 text-center mt-2">{user.tagline}</p>
        </motion.div>
      ))}
    </div>
  );
}
