"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { SIMULATOR_CONTENT } from "@/data/simulator-content";

interface NodeDetailProps {
  nodeId: string | null;
  onClose: () => void;
}

export function NodeDetail({ nodeId, onClose }: NodeDetailProps) {
  const prefersReducedMotion = useReducedMotion();

  const content = nodeId
    ? (SIMULATOR_CONTENT.find((c) => c.id === nodeId) ?? null)
    : null;

  const animation = prefersReducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { height: 0, opacity: 0 },
        animate: { height: "auto", opacity: 1 },
        exit: { height: 0, opacity: 0 },
      };

  return (
    <AnimatePresence>
      {content && (
        <motion.div
          key={content.id}
          {...animation}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="overflow-hidden w-full max-w-3xl"
        >
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 relative mt-4">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-white text-xl leading-none"
              aria-label="Close panel"
            >
              ×
            </button>

            <h2 className="text-xl font-bold text-white mb-2">{content.name}</h2>
            <p className="text-gray-300 mb-4">{content.description}</p>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-400 uppercase mb-2">Triggers</h3>
                <ul className="space-y-1">
                  {content.triggers.map((t) => (
                    <li key={t} className="text-sm text-gray-300 flex items-start gap-2">
                      <span className="text-blue-400 mt-0.5">•</span>
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-400 uppercase mb-2">Outputs</h3>
                <ul className="space-y-1">
                  {content.outputs.map((o) => (
                    <li key={o} className="text-sm text-gray-300 flex items-start gap-2">
                      <span className="text-green-400 mt-0.5">•</span>
                      {o}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <p className="text-xs text-gray-500">{content.techDetail}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
