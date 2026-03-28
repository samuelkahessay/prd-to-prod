"use client";

import { useState } from "react";
import styles from "./app.module.css";
import {
  PIPELINE_NODES,
  TIMELINE_EVENTS,
  FAILURE_EVENTS,
  type PipelineNode,
  type TimelineEvent,
  type FailureEvent,
} from "./fixtures";

// ── Type helpers ───────────────────────────────────────────────────────────

type Tab = "simulator" | "replay" | "forensics";

// ── SVG layout constants ───────────────────────────────────────────────────

const SVG_W = 900;
const SVG_H = 160;
const NODE_W = 130;
const NODE_H = 48;
const NODE_Y = SVG_H / 2 - NODE_H / 2;

// Evenly distribute nodes horizontally with padding
const NODE_PADDING = 24;
const NODE_STEP = (SVG_W - 2 * NODE_PADDING - NODE_W) / (PIPELINE_NODES.length - 1);

function nodeX(index: number): number {
  return NODE_PADDING + index * NODE_STEP;
}

// Center of node rectangle
function nodeCX(index: number): number {
  return nodeX(index) + NODE_W / 2;
}

const NODE_CY = SVG_H / 2;

// ══════════════════════════════════════════════════════════════════════════
// SIMULATOR TAB
// ══════════════════════════════════════════════════════════════════════════

function SimulatorTab() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = PIPELINE_NODES.find((n) => n.id === selectedId) ?? null;

  function handleNodeClick(node: PipelineNode) {
    setSelectedId((prev) => (prev === node.id ? null : node.id));
  }

  function buildArrowPath(fromIdx: number, toIdx: number): string {
    const x1 = nodeX(fromIdx) + NODE_W;
    const y1 = NODE_CY;
    const x2 = nodeX(toIdx);
    const y2 = NODE_CY;
    const cpX = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${cpX} ${y1} ${cpX} ${y2} ${x2} ${y2}`;
  }

  return (
    <div className={styles.simulatorWrap}>
      <div className={styles.graphWrap}>
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className={styles.graphSvg}
          aria-label="Pipeline stage diagram"
          role="img"
        >
          {/* Connector arrows between nodes */}
          {PIPELINE_NODES.slice(0, -1).map((node, i) => {
            const nextNode = PIPELINE_NODES[i + 1];
            const isActive =
              selectedId === node.id || selectedId === nextNode.id;
            return (
              <path
                key={`conn-${node.id}`}
                d={buildArrowPath(i, i + 1)}
                className={isActive ? styles.connectorActive : styles.connector}
              />
            );
          })}

          {/* Arrowheads marker def */}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="8"
              markerHeight="6"
              refX="8"
              refY="3"
              orient="auto"
            >
              <polygon
                points="0 0, 8 3, 0 6"
                fill="#484f58"
              />
            </marker>
            <marker
              id="arrowhead-active"
              markerWidth="8"
              markerHeight="6"
              refX="8"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill="#58a6ff" />
            </marker>
          </defs>

          {/* Pipeline nodes */}
          {PIPELINE_NODES.map((node, i) => {
            const x = nodeX(i);
            const isSelected = selectedId === node.id;
            const isActive = node.status === "active";

            return (
              <g
                key={node.id}
                role="button"
                aria-label={`${node.label} pipeline stage`}
                aria-pressed={isSelected}
                tabIndex={0}
                onClick={() => handleNodeClick(node)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleNodeClick(node);
                  }
                }}
                style={{ cursor: "pointer" }}
              >
                {/* Glow effect for active/selected nodes */}
                {(isSelected || isActive) && (
                  <rect
                    x={x - 4}
                    y={NODE_Y - 4}
                    width={NODE_W + 8}
                    height={NODE_H + 8}
                    rx={14}
                    fill={isSelected ? "#58a6ff" : "#3fb950"}
                    className={styles.nodeGlow}
                  />
                )}

                {/* Node body */}
                <rect
                  x={x}
                  y={NODE_Y}
                  width={NODE_W}
                  height={NODE_H}
                  rx={10}
                  fill={isSelected ? "rgba(88,166,255,0.1)" : "#161b22"}
                  stroke={isSelected ? "#58a6ff" : isActive ? "#3fb950" : "#30363d"}
                  strokeWidth={isSelected ? 2 : 1.5}
                />

                {/* Node label */}
                <text
                  x={x + NODE_W / 2}
                  y={NODE_CY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={isSelected ? "#58a6ff" : "#e6edf3"}
                  fontSize={11}
                  fontWeight={600}
                  fontFamily="system-ui, sans-serif"
                  style={{ pointerEvents: "none", userSelect: "none" }}
                >
                  {node.label}
                </text>

                {/* Status dot */}
                <circle
                  cx={x + NODE_W - 14}
                  cy={NODE_Y + 12}
                  r={4}
                  fill={isActive ? "#3fb950" : "#30363d"}
                />
              </g>
            );
          })}
        </svg>
      </div>

      <p className={styles.clickHint}>Click a stage to see details</p>

      {/* Node detail panel */}
      {selected && (
        <div className={styles.nodeDetail} role="region" aria-label={`${selected.label} details`}>
          <div className={styles.nodeDetailHeader}>
            <h3 className={styles.nodeDetailTitle}>{selected.label}</h3>
            <span
              className={`${styles.nodeStatusBadge} ${
                selected.status === "active"
                  ? styles.nodeStatusActive
                  : styles.nodeStatusIdle
              }`}
            >
              {selected.status === "active" ? "active" : "idle"}
            </span>
            <button
              className={styles.closeBtn}
              onClick={() => setSelectedId(null)}
              aria-label="Close detail panel"
            >
              ×
            </button>
          </div>

          <p className={styles.nodeDetailDesc}>{selected.description}</p>

          <div className={styles.nodeDetailLists}>
            <div className={styles.nodeDetailListGroup}>
              <p className={styles.nodeDetailListLabel}>Triggers</p>
              <ul className={styles.nodeDetailList}>
                {selected.triggers.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
            <div className={styles.nodeDetailListGroup}>
              <p className={styles.nodeDetailListLabel}>Outputs</p>
              <ul className={styles.nodeDetailList}>
                {selected.outputs.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// REPLAY TAB
// ══════════════════════════════════════════════════════════════════════════

const EVENT_TYPE_COLORS: Record<TimelineEvent["type"], string> = {
  issue: "#58a6ff",
  pr: "#3fb950",
  merge: "#d29922",
  ci: "#f85149",
};

const EVENT_TYPE_LABELS: Record<TimelineEvent["type"], string> = {
  issue: "Issue",
  pr: "PR",
  merge: "Merge",
  ci: "CI",
};

function formatTs(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }) + " UTC";
}

function ReplayTab() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Sort events chronologically
  const sorted = [...TIMELINE_EVENTS].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const selected = sorted.find((e) => e.id === selectedId) ?? null;

  // Map events to horizontal positions (0..100%)
  const minT = new Date(sorted[0].timestamp).getTime();
  const maxT = new Date(sorted[sorted.length - 1].timestamp).getTime();
  const range = maxT - minT || 1;

  function eventPct(event: TimelineEvent): number {
    const t = new Date(event.timestamp).getTime();
    return ((t - minT) / range) * 92 + 4; // 4%..96% so dots don't clip edges
  }

  return (
    <div className={styles.replayWrap}>
      {/* Legend */}
      <div className={styles.legend} aria-label="Event type legend">
        {(["issue", "pr", "merge", "ci"] as const).map((type) => (
          <div key={type} className={styles.legendItem}>
            <span
              className={styles.legendDot}
              style={{ background: EVENT_TYPE_COLORS[type] }}
            />
            {EVENT_TYPE_LABELS[type]}
          </div>
        ))}
      </div>

      {/* Scrollable timeline */}
      <div className={styles.timelineScroll} role="region" aria-label="Event timeline">
        <div className={styles.timelineTrack}>
          <div className={styles.timelineLine} />
          {sorted.map((event) => (
            <button
              key={event.id}
              className={`${styles.eventDot} ${
                selectedId === event.id ? styles.eventDotSelected : ""
              }`}
              style={{
                left: `${eventPct(event)}%`,
                background: EVENT_TYPE_COLORS[event.type],
              }}
              onClick={() =>
                setSelectedId((prev) => (prev === event.id ? null : event.id))
              }
              aria-label={`${EVENT_TYPE_LABELS[event.type]}: ${event.title}`}
              aria-pressed={selectedId === event.id}
            />
          ))}
        </div>
      </div>

      <p className={styles.timelineHint}>Click a dot to see event details</p>

      {/* Event detail panel */}
      {selected && (
        <div
          className={styles.eventDetail}
          role="region"
          aria-label="Event details"
        >
          <div className={styles.eventDetailHeader}>
            <span
              className={`${styles.eventTypeBadge} ${
                selected.type === "issue"
                  ? styles.badgeIssue
                  : selected.type === "pr"
                  ? styles.badgePr
                  : selected.type === "merge"
                  ? styles.badgeMerge
                  : styles.badgeCi
              }`}
            >
              {EVENT_TYPE_LABELS[selected.type]}
            </span>
            <div>
              <h3 className={styles.eventDetailTitle}>{selected.title}</h3>
              <p className={styles.eventDetailTs}>{formatTs(selected.timestamp)}</p>
            </div>
          </div>
          <p className={styles.eventDetailBody}>{selected.details}</p>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// FORENSICS TAB
// ══════════════════════════════════════════════════════════════════════════

function ForensicsTab() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function handleToggle(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <div className={styles.forensicsWrap}>
      <h2 className={styles.sectionHeading}>CI failures &amp; resolutions</h2>

      <div className={styles.failureList}>
        {FAILURE_EVENTS.map((failure) => {
          const isOpen = expandedId === failure.id;
          return (
            <article key={failure.id} className={styles.failureCard}>
              <div
                className={styles.failureCardHeader}
                onClick={() => handleToggle(failure.id)}
                role="button"
                tabIndex={0}
                aria-expanded={isOpen}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleToggle(failure.id);
                  }
                }}
              >
                <span
                  className={`${styles.severityDot} ${
                    failure.severity === "high"
                      ? styles.severityHigh
                      : failure.severity === "medium"
                      ? styles.severityMedium
                      : styles.severityLow
                  }`}
                />

                <div className={styles.failureCardMain}>
                  <div className={styles.failureCardMeta}>
                    <span
                      className={`${styles.severityBadge} ${
                        failure.severity === "high"
                          ? styles.badgeHigh
                          : failure.severity === "medium"
                          ? styles.badgeMedium
                          : styles.badgeLow
                      }`}
                    >
                      {failure.severity}
                    </span>
                    <span className={styles.categoryBadge}>{failure.category}</span>
                    <span className={styles.prRef}>{failure.pr}</span>
                  </div>
                  <p className={styles.failureError}>{failure.error}</p>
                </div>

                <span
                  className={`${styles.expandChevron} ${
                    isOpen ? styles.expandChevronOpen : ""
                  }`}
                  aria-hidden
                >
                  ▾
                </span>
              </div>

              {isOpen && (
                <div className={styles.resolutionPanel}>
                  <p className={styles.resolutionLabel}>Resolution</p>
                  <p className={styles.resolutionText}>{failure.resolution}</p>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// ROOT APP
// ══════════════════════════════════════════════════════════════════════════

const TABS: { id: Tab; label: string }[] = [
  { id: "simulator", label: "Simulator" },
  { id: "replay", label: "Replay" },
  { id: "forensics", label: "Forensics" },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("simulator");

  return (
    <div className={styles.shell}>
      {/* Tab bar */}
      <nav className={styles.tabBar} aria-label="Observatory views">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ""}`}
            onClick={() => setActiveTab(tab.id)}
            aria-selected={activeTab === tab.id}
            role="tab"
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Tab content */}
      <main className={styles.content}>
        {activeTab === "simulator" && <SimulatorTab />}
        {activeTab === "replay" && <ReplayTab />}
        {activeTab === "forensics" && <ForensicsTab />}
      </main>
    </div>
  );
}
