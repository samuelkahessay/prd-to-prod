"use client";

import { motion, AnimatePresence } from "framer-motion";

export type ParticleType = "Issues" | "PRs" | "Review" | "Dispatch";

const PARTICLE_COLORS: Record<ParticleType, string> = {
  Issues: "#3b82f6",
  PRs: "#22c55e",
  Review: "#eab308",
  Dispatch: "#a855f7",
};

// Sample a cubic bezier path "M x0 y0 C cx1 cy1, cx2 cy2, x1 y1" at parameter t ∈ [0,1]
function sampleBezier(d: string, t: number): { x: number; y: number } {
  const nums = d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
  if (nums.length < 8) return { x: 0, y: 0 };
  const [x0, y0, cx1, cy1, cx2, cy2, x1, y1] = nums;
  const u = 1 - t;
  return {
    x: u * u * u * x0 + 3 * u * u * t * cx1 + 3 * u * t * t * cx2 + t * t * t * x1,
    y: u * u * u * y0 + 3 * u * u * t * cy1 + 3 * u * t * t * cy2 + t * t * t * y1,
  };
}

const KEYFRAME_STEPS = 20;

export interface MessageParticleProps {
  id: string;
  type: ParticleType;
  pathD: string;
  duration: number; // seconds
  onComplete: (id: string) => void;
}

export function MessageParticle({ id, type, pathD, duration, onComplete }: MessageParticleProps) {
  const color = PARTICLE_COLORS[type];
  const pts = Array.from({ length: KEYFRAME_STEPS }, (_, i) =>
    sampleBezier(pathD, i / (KEYFRAME_STEPS - 1))
  );
  const cxFrames = pts.map((p) => p.x);
  const cyFrames = pts.map((p) => p.y);

  return (
    <AnimatePresence>
      <g aria-label={`particle-${type}`}>
        <motion.circle
          r={6}
          fill={color}
          initial={{ cx: cxFrames[0], cy: cyFrames[0], opacity: 0 }}
          animate={{ cx: cxFrames, cy: cyFrames, opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration, ease: "linear" }}
          onAnimationComplete={() => onComplete(id)}
        />
        <motion.text
          textAnchor="middle"
          fontSize={8}
          fill="#f9fafb"
          dominantBaseline="middle"
          initial={{ x: cxFrames[0], y: cyFrames[0] - 12, opacity: 0 }}
          animate={{ x: cxFrames, y: cyFrames.map((y) => y - 12), opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration, ease: "linear" }}
        >
          {type}
        </motion.text>
      </g>
    </AnimatePresence>
  );
}
