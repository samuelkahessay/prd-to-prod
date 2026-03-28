"use client";

import { PrdToProdAnimation } from "@/components/shared/prd-to-prod-animation";

/**
 * Filmstrip diagnostic: renders the Full animation frozen at each keyframe.
 * Uses animation-play-state:paused + negative animation-delay to freeze time.
 * Temporary — delete after tuning.
 */

const FRAMES = [
  { pct: 0, label: "0% — static prd" },
  { pct: 25, label: "25% — o still invisible" },
  { pct: 28, label: "28% — d starts shifting" },
  { pct: 31, label: "31% — o appears, mid-fall" },
  { pct: 33, label: "33% — o descending, d clearing" },
  { pct: 35, label: "35% — o lands, d shifts, squash" },
  { pct: 38, label: "38% — p ripple peak" },
  { pct: 42, label: "42% — o bounce up" },
  { pct: 48, label: "48% — settle" },
  { pct: 54, label: "54% — fully settled prod" },
  { pct: 80, label: "80% — hold" },
  { pct: 90, label: "90% — o exits" },
];

const DURATION = 3.6; // seconds

export default function FilmstripPage() {
  return (
    <div style={{ padding: 32, background: "var(--cream, #f8f6f1)", minHeight: "100vh" }}>
      <h1 style={{ fontFamily: "var(--font-mono)", fontSize: 16, marginBottom: 24, color: "var(--ink)" }}>
        Animation Filmstrip — Full variant, {DURATION}s cycle
      </h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 24 }}>
        {FRAMES.map(({ pct, label }, i) => {
          const frameNum = i + 1;
          const freezeAt = `-${(pct / 100) * DURATION}s`;
          return (
            <div key={pct} style={{ textAlign: "center" }}>
              <div
                style={{
                  background: "var(--warm-white, #fff)",
                  border: "1px solid var(--rule, #e0ddd8)",
                  borderRadius: 12,
                  padding: "40px 16px",
                  position: "relative",
                }}
              >
                {/* Frame number badge */}
                <div style={{
                  position: "absolute",
                  top: 8,
                  left: 8,
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: "var(--ink, #1a1a1a)",
                  color: "var(--warm-white, #fff)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  {frameNum}
                </div>
                {/* Global freeze: pause all animations at the target time */}
                <style>{`
                  [data-freeze="${pct}"] * {
                    animation-play-state: paused !important;
                    animation-delay: ${freezeAt} !important;
                  }
                `}</style>
                <div data-freeze={pct}>
                  <PrdToProdAnimation size={48} amplitude="full" />
                </div>
              </div>
              <div style={{ marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-muted, #888)" }}>
                <strong>#{frameNum}</strong> {label}
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-muted, #aaa)" }}>
                t = {((pct / 100) * DURATION).toFixed(2)}s
              </div>
            </div>
          );
        })}
      </div>

      {/* Live animation for comparison */}
      <div style={{
        marginTop: 48,
        padding: "48px 0",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
        borderTop: "1px solid var(--rule, #e0ddd8)",
      }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-muted, #888)" }}>
          Live — Full variant
        </div>
        <PrdToProdAnimation size={80} amplitude="full" />
      </div>
    </div>
  );
}
