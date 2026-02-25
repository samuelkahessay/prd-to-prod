"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Node data
const NODES = [
  { id: "decomposer", label: "PRD Decomposer", icon: "📋", cx: 112, cy: 100 },
  { id: "assist", label: "Repo Assist", icon: "🤖", cx: 337, cy: 100 },
  { id: "reviewer", label: "PR Reviewer", icon: "🔍", cx: 562, cy: 100 },
  { id: "merge", label: "Auto-Merge", icon: "✅", cx: 787, cy: 100 },
] as const;

type NodeId = (typeof NODES)[number]["id"];
type NodeState = "idle" | "active" | "completed";

const NODE_SEQUENCE: NodeId[] = ["decomposer", "assist", "reviewer", "merge"];

// Curved path between consecutive nodes
function forwardPath(x1: number, x2: number, y: number): string {
  const mx = (x1 + x2) / 2;
  return `M ${x1 + 75} ${y} C ${mx} ${y}, ${mx} ${y}, ${x2 - 75} ${y}`;
}

// Dashed return path: Merge → Assist (below the nodes)
const RETURN_PATH = `M 787 ${100 + 45} C 787 165, 337 165, 337 ${100 + 45}`;

interface PipelineGraphProps {
  speed: number; // multiplier: 0.5 | 1 | 2
}

export function PipelineGraph({ speed }: PipelineGraphProps) {
  const [states, setStates] = useState<Record<NodeId, NodeState>>({
    decomposer: "idle",
    assist: "idle",
    reviewer: "idle",
    merge: "idle",
  });

  const reset = useCallback(() => {
    setStates({ decomposer: "idle", assist: "idle", reviewer: "idle", merge: "idle" });
  }, []);

  const activateChain = useCallback(
    (startIndex: number) => {
      const delay = 1500 / speed;
      for (let i = startIndex; i < NODE_SEQUENCE.length; i++) {
        const nodeId = NODE_SEQUENCE[i];
        setTimeout(() => {
          setStates((prev) => ({ ...prev, [nodeId]: "active" }));
          setTimeout(() => {
            setStates((prev) => ({ ...prev, [nodeId]: "completed" }));
          }, delay);
        }, i * delay * 2);
      }
    },
    [speed]
  );

  const handleNodeClick = useCallback(
    (id: NodeId) => {
      if (id === "decomposer") {
        reset();
        // slight delay to let reset render first
        setTimeout(() => activateChain(0), 50);
      } else {
        const idx = NODE_SEQUENCE.indexOf(id);
        activateChain(idx);
      }
    },
    [reset, activateChain]
  );

  function borderColor(s: NodeState) {
    if (s === "active") return "#3b82f6"; // blue-500
    if (s === "completed") return "#22c55e"; // green-500
    return "#4b5563"; // gray-600
  }

  function glowFilter(s: NodeState): string {
    if (s === "active") return "drop-shadow(0 0 8px rgba(59,130,246,0.7))";
    return "none";
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <svg
        viewBox="0 0 900 200"
        className="w-full max-w-3xl"
        aria-label="Pipeline node graph"
        role="img"
      >
        {/* Forward connections */}
        {[0, 1, 2].map((i) => (
          <path
            key={`fwd-${i}`}
            d={forwardPath(NODES[i].cx, NODES[i + 1].cx, NODES[i].cy)}
            stroke="#4b5563"
            strokeWidth={2}
            fill="none"
          />
        ))}

        {/* Dashed return path: Merge → Assist */}
        <path
          d={RETURN_PATH}
          stroke="#6b7280"
          strokeWidth={1.5}
          strokeDasharray="6 4"
          fill="none"
          markerEnd="url(#arrow)"
        />

        <defs>
          <marker id="arrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
            <path d="M0,0 L0,8 L8,4 z" fill="#6b7280" />
          </marker>
        </defs>

        {/* Nodes */}
        {NODES.map(({ id, label, icon, cx, cy }) => {
          const s = states[id];
          return (
            <motion.g
              key={id}
              onClick={() => handleNodeClick(id)}
              style={{ cursor: "pointer" }}
              animate={{ scale: s === "active" ? [1, 1.05, 1] : 1 }}
              transition={{ duration: 0.4 }}
              aria-label={`${label}: ${s}`}
              role="button"
            >
              <motion.rect
                x={cx - 75}
                y={cy - 40}
                width={150}
                height={80}
                rx={12}
                fill="#1f2937"
                stroke={borderColor(s)}
                strokeWidth={2}
                animate={{ stroke: borderColor(s), filter: glowFilter(s) }}
                transition={{ duration: 0.3 }}
              />
              <text x={cx} y={cy - 10} textAnchor="middle" fontSize={22} dominantBaseline="middle">
                {icon}
              </text>
              <text
                x={cx}
                y={cy + 18}
                textAnchor="middle"
                fontSize={11}
                fill={s === "idle" ? "#9ca3af" : "#f9fafb"}
                dominantBaseline="middle"
              >
                {label}
              </text>
              <AnimatePresence>
                {s === "completed" && (
                  <motion.text
                    key="check"
                    x={cx + 58}
                    y={cy - 28}
                    fontSize={14}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    ✓
                  </motion.text>
                )}
              </AnimatePresence>
            </motion.g>
          );
        })}
      </svg>
    </div>
  );
}
