"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageParticle, ParticleType } from "./message-particle";

// Node data
const NODES = [
  { id: "decomposer", label: "PRD Decomposer", icon: "📋", cx: 150, cy: 150 },
  { id: "assist", label: "Repo Assist", icon: "🤖", cx: 450, cy: 150 },
  { id: "reviewer", label: "PR Reviewer", icon: "🔍", cx: 750, cy: 150 },
  { id: "merge", label: "Auto-Merge", icon: "✅", cx: 1050, cy: 150 },
] as const;

type NodeId = (typeof NODES)[number]["id"];
type NodeState = "idle" | "active" | "completed";

const NODE_SEQUENCE: NodeId[] = ["decomposer", "assist", "reviewer", "merge"];

// Curved path between consecutive nodes
function forwardPath(x1: number, x2: number, y: number): string {
  const mx = (x1 + x2) / 2;
  return `M ${x1 + 100} ${y} C ${mx} ${y}, ${mx} ${y}, ${x2 - 100} ${y}`;
}

// Dashed return path: Merge → Assist (below the nodes)
const RETURN_PATH = `M 1050 ${150 + 55} C 1050 245, 450 245, 450 ${150 + 55}`;

const EDGE_PATHS = [
  forwardPath(150, 450, 150),
  forwardPath(450, 750, 150),
  forwardPath(750, 1050, 150),
  RETURN_PATH,
];

const EDGE_TYPES: ParticleType[] = ["Issues", "PRs", "Review", "Dispatch"];

interface Particle {
  id: string;
  pathIndex: number;
}

interface PipelineGraphProps {
  speed: number; // multiplier: 0.5 | 1 | 2
  onNodeSelect?: (id: string) => void;
}

export function PipelineGraph({ speed, onNodeSelect }: PipelineGraphProps) {
  const [states, setStates] = useState<Record<NodeId, NodeState>>({
    decomposer: "idle",
    assist: "idle",
    reviewer: "idle",
    merge: "idle",
  });
  const [particles, setParticles] = useState<Particle[]>([]);

  const reset = useCallback(() => {
    setStates({ decomposer: "idle", assist: "idle", reviewer: "idle", merge: "idle" });
  }, []);

  const removeParticle = useCallback((id: string) => {
    setParticles((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const activateChain = useCallback(
    (startIndex: number) => {
      const delay = 1500 / speed;
      for (let i = startIndex; i < NODE_SEQUENCE.length; i++) {
        const nodeId = NODE_SEQUENCE[i];
        const edgeIndex = i;
        setTimeout(() => {
          setStates((prev) => ({ ...prev, [nodeId]: "active" }));
          // Spawn a particle for each active node's outgoing edge
          const pId = `p-${edgeIndex}-${Date.now()}`;
          setParticles((prev) => [...prev, { id: pId, pathIndex: edgeIndex }]);
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
      onNodeSelect?.(id);
      if (id === "decomposer") {
        reset();
        // slight delay to let reset render first
        setTimeout(() => activateChain(0), 50);
      } else {
        const idx = NODE_SEQUENCE.indexOf(id);
        activateChain(idx);
      }
    },
    [reset, activateChain, onNodeSelect]
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
    <div className="w-full flex flex-col items-center gap-6">
      <svg
        viewBox="0 0 1200 300"
        className="w-full"
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
                x={cx - 100}
                y={cy - 55}
                width={200}
                height={110}
                rx={14}
                fill="#1f2937"
                stroke={borderColor(s)}
                strokeWidth={2}
                animate={{ stroke: borderColor(s), filter: glowFilter(s) }}
                transition={{ duration: 0.3 }}
              />
              <text x={cx} y={cy - 14} textAnchor="middle" fontSize={30} dominantBaseline="middle">
                {icon}
              </text>
              <text
                x={cx}
                y={cy + 24}
                textAnchor="middle"
                fontSize={14}
                fill={s === "idle" ? "#9ca3af" : "#f9fafb"}
                dominantBaseline="middle"
              >
                {label}
              </text>
              <AnimatePresence>
                {s === "completed" && (
                  <motion.text
                    key="check"
                    x={cx + 78}
                    y={cy - 43}
                    fontSize={18}
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
        {/* Message particles */}
        <AnimatePresence>
          {particles.map((p) => (
            <MessageParticle
              key={p.id}
              id={p.id}
              type={EDGE_TYPES[p.pathIndex]}
              pathD={EDGE_PATHS[p.pathIndex]}
              duration={1 / speed}
              onComplete={removeParticle}
            />
          ))}
        </AnimatePresence>
      </svg>
    </div>
  );
}
