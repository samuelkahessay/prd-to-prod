"use client";

import { useState } from "react";
import { useComplianceStore } from "./store";
import type {
  ComplianceScan,
  ComplianceDisposition,
  ComplianceFinding,
  ContentType,
} from "./store";
import styles from "./app.module.css";

// ── Badge helpers ─────────────────────────────────────────────────────────────

function dispositionClass(d: ComplianceDisposition): string {
  switch (d) {
    case "AUTO_BLOCK":
      return styles.badgeAutoBlock;
    case "HUMAN_REQUIRED":
      return styles.badgeHumanRequired;
    case "ADVISORY":
      return styles.badgeAdvisory;
  }
}

function dispositionLabel(d: ComplianceDisposition): string {
  switch (d) {
    case "AUTO_BLOCK":
      return "AUTO_BLOCK";
    case "HUMAN_REQUIRED":
      return "HUMAN_REQUIRED";
    case "ADVISORY":
      return "ADVISORY";
  }
}

function dispositionBannerClass(d: ComplianceDisposition, isEmpty: boolean): string {
  if (isEmpty) return styles.dispositionBannerClean;
  switch (d) {
    case "AUTO_BLOCK":
      return styles.dispositionBannerAutoBlock;
    case "HUMAN_REQUIRED":
      return styles.dispositionBannerHumanRequired;
    case "ADVISORY":
      return styles.dispositionBannerAdvisory;
  }
}

function severityClass(s: string): string {
  switch (s) {
    case "Critical":
      return styles.badgeCritical;
    case "High":
      return styles.badgeHigh;
    case "Medium":
      return styles.badgeMedium;
    default:
      return styles.badgeLow;
  }
}

function regulationClass(r: string): string {
  return r === "PIPEDA" ? styles.badgePIPEDA : styles.badgeFINTRAC;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "";
  }
}

// ── Donut chart ───────────────────────────────────────────────────────────────

interface DonutSlice {
  label: string;
  count: number;
  color: string;
}

function DonutChart({ slices }: { slices: DonutSlice[] }) {
  const R = 34;
  const C = 2 * Math.PI * R;
  const total = slices.reduce((s, x) => s + x.count, 0);

  if (total === 0) {
    return (
      <div className={styles.doughnutWrap}>
        <svg className={styles.doughnutSvg} viewBox="0 0 80 80">
          <circle cx="40" cy="40" r={R} fill="none" stroke="#374151" strokeWidth="10" />
        </svg>
        <div className={styles.doughnutLegend}>
          <span className={styles.doughnutLabel} style={{ color: "var(--cs-text-faint)" }}>
            No data
          </span>
        </div>
      </div>
    );
  }

  let offset = 0;
  const arcs = slices
    .filter((s) => s.count > 0)
    .map((s) => {
      const dash = (s.count / total) * C;
      const gap = C - dash;
      const arc = { ...s, dash, gap, offset };
      offset += dash;
      return arc;
    });

  return (
    <div className={styles.doughnutWrap}>
      <svg className={styles.doughnutSvg} viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={R} fill="none" stroke="#374151" strokeWidth="10" />
        {arcs.map((arc, i) => (
          <circle
            key={i}
            cx="40"
            cy="40"
            r={R}
            fill="none"
            stroke={arc.color}
            strokeWidth="10"
            strokeDasharray={`${arc.dash} ${arc.gap}`}
            strokeDashoffset={-arc.offset}
            strokeLinecap="butt"
          />
        ))}
      </svg>
      <div className={styles.doughnutLegend}>
        {slices
          .filter((s) => s.count > 0)
          .map((s) => (
            <div key={s.label} className={styles.doughnutItem}>
              <span className={styles.doughnutDot} style={{ background: s.color }} />
              <span className={styles.doughnutLabel}>{s.label}</span>
              <span className={styles.doughnutCount}>{s.count}</span>
            </div>
          ))}
      </div>
    </div>
  );
}

// ── Finding card ──────────────────────────────────────────────────────────────

function FindingCard({
  finding,
  scanId,
  scanDecision,
  onDecide,
}: {
  finding: ComplianceFinding;
  scanId: string;
  scanDecision?: "approved" | "rejected";
  onDecide?: (scanId: string, decision: "approved" | "rejected") => void;
}) {
  const isHumanRequired = finding.disposition === "HUMAN_REQUIRED";

  return (
    <div className={styles.findingCard}>
      <div className={styles.findingHeader}>
        <span className={styles.findingRuleId}>{finding.ruleId}</span>
        <p className={styles.findingDescription}>{finding.description}</p>
        {finding.citation && (
          <span className={styles.findingCitation}>{finding.citation}</span>
        )}
      </div>
      <div className={styles.findingMeta}>
        <span className={`${styles.badge} ${regulationClass(finding.regulation)}`}>
          {finding.regulation}
        </span>
        <span className={`${styles.badge} ${severityClass(finding.severity)}`}>
          {finding.severity}
        </span>
        <span className={`${styles.badge} ${dispositionClass(finding.disposition)}`}>
          {dispositionLabel(finding.disposition)}
        </span>
        {finding.lineNumber && (
          <span className={styles.findingLineNum}>line {finding.lineNumber}</span>
        )}
      </div>
      {finding.codeSnippet && (
        <div className={styles.findingSnippet}>{finding.codeSnippet}</div>
      )}

      {/* Operator decision area — only for HUMAN_REQUIRED */}
      {isHumanRequired && onDecide && (
        <div className={styles.findingActions}>
          {scanDecision ? (
            <span
              className={`${styles.decisionTag} ${
                scanDecision === "approved" ? styles.decisionApproved : styles.decisionRejected
              }`}
            >
              Operator {scanDecision}
            </span>
          ) : (
            <>
              <button
                className={styles.approveBtn}
                onClick={() => onDecide(scanId, "approved")}
              >
                Approve
              </button>
              <button
                className={styles.rejectBtn}
                onClick={() => onDecide(scanId, "rejected")}
              >
                Reject
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Scan tab ──────────────────────────────────────────────────────────────────

function ScanTab({
  onSubmit,
  latestScan,
  onDecide,
}: {
  onSubmit: (content: string, type: ContentType, label: string) => void;
  latestScan: ComplianceScan | null;
  onDecide: (scanId: string, decision: "approved" | "rejected") => void;
}) {
  const [content, setContent] = useState("");
  const [contentType, setContentType] = useState<ContentType>("CODE");
  const [sourceLabel, setSourceLabel] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    onSubmit(content.trim(), contentType, sourceLabel);
    setContent("");
    setSourceLabel("");
  }

  const hasFindings = latestScan && latestScan.findings.length > 0;
  const isClean = latestScan && latestScan.findings.length === 0;

  return (
    <>
      {/* Input form */}
      <div className={styles.scanPanel}>
        <p className={styles.scanPanelTitle}>Submit for scanning</p>
        <form onSubmit={handleSubmit}>
          <div className={styles.formRow}>
            <select
              className={styles.formSelect}
              value={contentType}
              onChange={(e) => setContentType(e.target.value as ContentType)}
            >
              <option value="CODE">CODE</option>
              <option value="DIFF">DIFF</option>
              <option value="LOG">LOG</option>
              <option value="FREETEXT">FREETEXT</option>
            </select>
            <input
              className={styles.formInput}
              type="text"
              value={sourceLabel}
              onChange={(e) => setSourceLabel(e.target.value)}
              placeholder="Source label (optional) — e.g. auth/login.ts"
            />
          </div>
          <textarea
            className={styles.formTextarea}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={`Paste ${contentType.toLowerCase()} content to scan for PIPEDA and FINTRAC violations…`}
            rows={6}
          />
          <div className={styles.formActions}>
            <button type="submit" className={styles.scanBtn} disabled={!content.trim()}>
              Scan
            </button>
          </div>
        </form>
      </div>

      {/* Results of most recent scan */}
      {latestScan && (
        <div className={styles.resultsPanel}>
          <div className={styles.resultsPanelHeader}>
            <span className={styles.resultsPanelTitle}>Last scan results</span>
            <span className={`${styles.badge} ${dispositionClass(latestScan.disposition)}`}>
              {dispositionLabel(latestScan.disposition)}
            </span>
          </div>

          <div
            className={`${styles.dispositionBanner} ${dispositionBannerClass(
              latestScan.disposition,
              latestScan.findings.length === 0
            )}`}
          >
            {isClean ? (
              <>CLEAN — no violations detected</>
            ) : (
              <>
                {latestScan.findings.length} finding
                {latestScan.findings.length !== 1 ? "s" : ""} ·{" "}
                {dispositionLabel(latestScan.disposition)}
                {latestScan.disposition === "HUMAN_REQUIRED" &&
                  !latestScan.operatorDecision &&
                  " — awaiting operator decision"}
                {latestScan.operatorDecision &&
                  ` — operator ${latestScan.operatorDecision}`}
              </>
            )}
          </div>

          {hasFindings && (
            <div className={styles.findingList}>
              {latestScan.findings.map((f) => (
                <FindingCard
                  key={f.id}
                  finding={f}
                  scanId={latestScan.id}
                  scanDecision={latestScan.operatorDecision}
                  onDecide={latestScan.disposition === "HUMAN_REQUIRED" ? onDecide : undefined}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ── History tab ───────────────────────────────────────────────────────────────

function HistoryScanCard({
  scan,
  onDecide,
}: {
  scan: ComplianceScan;
  onDecide: (scanId: string, decision: "approved" | "rejected") => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article className={styles.historyCard}>
      <div
        onClick={() => setExpanded((v) => !v)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setExpanded((v) => !v);
        }}
        aria-expanded={expanded}
      >
        <div className={styles.historyCardHeader}>
          <span className={styles.historySourceLabel}>{scan.sourceLabel}</span>
          <span className={`${styles.badge} ${dispositionClass(scan.disposition)}`}>
            {dispositionLabel(scan.disposition)}
          </span>
          <span
            className={`${styles.expandChevron} ${expanded ? styles.expandChevronOpen : ""}`}
            aria-hidden
          >
            ▾
          </span>
        </div>
        <div className={styles.historyMeta}>
          <span className={styles.historyMetaItem}>{fmtDate(scan.submittedAt)}</span>
          <span className={styles.historyMetaItem}>·</span>
          <span className={styles.historyMetaItem}>{scan.contentType}</span>
          {scan.findings.length > 0 && (
            <>
              <span className={styles.historyMetaItem}>·</span>
              <span className={styles.historyFindingCount}>
                {scan.findings.length} finding{scan.findings.length !== 1 ? "s" : ""}
              </span>
            </>
          )}
          {scan.operatorDecision && (
            <>
              <span className={styles.historyMetaItem}>·</span>
              <span
                className={`${styles.decisionTag} ${
                  scan.operatorDecision === "approved"
                    ? styles.decisionApproved
                    : styles.decisionRejected
                }`}
              >
                {scan.operatorDecision}
              </span>
            </>
          )}
        </div>
      </div>

      {expanded && (
        <div className={styles.historyCardBody}>
          {scan.findings.length === 0 ? (
            <div className={styles.empty} style={{ padding: "1rem 0" }}>
              No findings — clean scan
            </div>
          ) : (
            <div className={styles.findingList}>
              {scan.findings.map((f) => (
                <FindingCard
                  key={f.id}
                  finding={f}
                  scanId={scan.id}
                  scanDecision={scan.operatorDecision}
                  onDecide={scan.disposition === "HUMAN_REQUIRED" ? onDecide : undefined}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function HistoryTab({
  scans,
  onDecide,
}: {
  scans: ComplianceScan[];
  onDecide: (scanId: string, decision: "approved" | "rejected") => void;
}) {
  return (
    <>
      <div className={styles.historyHeader}>
        <span className={styles.sectionLabel}>Scan history</span>
        <span className={styles.historyCount}>
          {scans.length} scan{scans.length !== 1 ? "s" : ""}
        </span>
      </div>

      {scans.length === 0 ? (
        <div className={styles.empty}>No scans yet. Submit content on the Scan tab.</div>
      ) : (
        <div className={styles.historyList}>
          {scans.map((scan) => (
            <HistoryScanCard key={scan.id} scan={scan} onDecide={onDecide} />
          ))}
        </div>
      )}
    </>
  );
}

// ── Dashboard tab ─────────────────────────────────────────────────────────────

function DashboardTab({ scans }: { scans: ComplianceScan[] }) {
  const total = scans.length;
  const autoBlock = scans.filter((s) => s.disposition === "AUTO_BLOCK").length;
  const humanRequired = scans.filter((s) => s.disposition === "HUMAN_REQUIRED").length;
  const advisory = scans.filter((s) => s.disposition === "ADVISORY").length;
  const pending = scans.filter(
    (s) => s.disposition === "HUMAN_REQUIRED" && !s.operatorDecision
  ).length;

  // Regulation breakdown — count unique regulations per scan
  let pipeScans = 0;
  let finScans = 0;
  for (const scan of scans) {
    const regs = new Set(scan.findings.map((f) => f.regulation));
    if (regs.has("PIPEDA")) pipeScans++;
    if (regs.has("FINTRAC")) finScans++;
  }

  const dispositionSlices: DonutSlice[] = [
    { label: "AUTO_BLOCK", count: autoBlock, color: "#ef4444" },
    { label: "HUMAN_REQ", count: humanRequired, color: "#f59e0b" },
    { label: "ADVISORY", count: advisory, color: "#22c55e" },
  ];

  const regulationSlices: DonutSlice[] = [
    { label: "PIPEDA", count: pipeScans, color: "#60a5fa" },
    { label: "FINTRAC", count: finScans, color: "#a78bfa" },
  ];

  return (
    <>
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total scans</span>
          <span className={styles.statValue}>{total}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>AUTO_BLOCK</span>
          <span className={`${styles.statValue} ${styles.statValueRed}`}>{autoBlock}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>HUMAN_REQUIRED</span>
          <span className={`${styles.statValue} ${styles.statValueAmber}`}>{humanRequired}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Pending decisions</span>
          <span className={`${styles.statValue} ${pending > 0 ? styles.statValueAmber : styles.statValueGreen}`}>
            {pending}
          </span>
        </div>
      </div>

      <div className={styles.chartsRow}>
        <div className={styles.chartCard}>
          <p className={styles.chartTitle}>By disposition</p>
          <DonutChart slices={dispositionSlices} />
        </div>
        <div className={styles.chartCard}>
          <p className={styles.chartTitle}>By regulation</p>
          <DonutChart slices={regulationSlices} />
        </div>
      </div>

      {total === 0 && (
        <div className={styles.empty}>
          No scans yet. Submit content on the Scan tab to see metrics.
        </div>
      )}
    </>
  );
}

// ── Main app ──────────────────────────────────────────────────────────────────

type Tab = "scan" | "history" | "dashboard";

export default function App() {
  const { scans, hydrated, submitScan, recordDecision } = useComplianceStore();
  const [activeTab, setActiveTab] = useState<Tab>("scan");
  const [latestScan, setLatestScan] = useState<ComplianceScan | null>(null);

  const pendingCount = scans.filter(
    (s) => s.disposition === "HUMAN_REQUIRED" && !s.operatorDecision
  ).length;

  if (!hydrated) {
    return (
      <div className={styles.shell}>
        <div className={styles.loading}>initializing scanner…</div>
      </div>
    );
  }

  function handleSubmit(content: string, type: ContentType, label: string) {
    const scan = submitScan(content, type, label);
    setLatestScan(scan);
  }

  function handleDecide(scanId: string, decision: "approved" | "rejected") {
    recordDecision(scanId, decision);
    // Update latestScan in place if it matches
    setLatestScan((prev) =>
      prev && prev.id === scanId ? { ...prev, operatorDecision: decision } : prev
    );
  }

  return (
    <div className={styles.shell}>
      {/* Tab bar */}
      <div className={styles.tabBar} role="tablist">
        {(["scan", "history", "dashboard"] as Tab[]).map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "scan" ? "Scan" : tab === "history" ? "History" : "Dashboard"}
            {tab === "history" && pendingCount > 0 && (
              <span className={styles.tabBadge}>{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className={styles.content} role="tabpanel">
        {activeTab === "scan" && (
          <ScanTab
            onSubmit={handleSubmit}
            latestScan={latestScan}
            onDecide={handleDecide}
          />
        )}
        {activeTab === "history" && (
          <HistoryTab scans={scans} onDecide={handleDecide} />
        )}
        {activeTab === "dashboard" && <DashboardTab scans={scans} />}
      </div>
    </div>
  );
}
