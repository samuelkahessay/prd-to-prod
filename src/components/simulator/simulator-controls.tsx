"use client";

import { useState } from "react";
import { PipelineGraph } from "./pipeline-graph";

const SPEED_OPTIONS = [0.5, 1, 2] as const;
type Speed = (typeof SPEED_OPTIONS)[number];

export default function SimulatorControls() {
  const [speed, setSpeed] = useState<Speed>(1);
  const [resetKey, setResetKey] = useState(0);

  return (
    <div className="flex flex-col items-center gap-8">
      <PipelineGraph key={resetKey} speed={speed} />

      {/* Reset button */}
      <button
        onClick={() => setResetKey((k) => k + 1)}
        className="px-6 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 text-sm font-medium transition-colors"
      >
        Reset
      </button>

      {/* Speed controls */}
      <div className="flex items-center gap-4">
        <span className="text-gray-400 text-sm">Speed:</span>
        {SPEED_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setSpeed(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              speed === s
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            {s}x
          </button>
        ))}
      </div>
    </div>
  );
}
