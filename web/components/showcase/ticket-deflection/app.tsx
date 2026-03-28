"use client";

import { useState } from "react";
import { useTicketStore } from "./store";
import type { Ticket, ActivityLogEntry, TicketCategory, TicketSeverity, TicketStatus } from "./store";
import styles from "./app.module.css";

// ── Badge helpers ──────────────────────────────────────────────────────────

function statusClass(status: TicketStatus): string {
  switch (status) {
    case "New":
      return styles.badgeNew;
    case "Classified":
      return styles.badgeClassified;
    case "Matched":
      return styles.badgeMatched;
    case "AutoResolved":
      return styles.badgeAutoResolved;
    case "Escalated":
      return styles.badgeEscalated;
  }
}

function categoryClass(category: TicketCategory | null): string {
  switch (category) {
    case "Bug":
      return styles.badgeCatBug;
    case "FeatureRequest":
      return styles.badgeCatFeature;
    case "HowTo":
      return styles.badgeCatHowTo;
    case "AccountIssue":
      return styles.badgeCatAccount;
    default:
      return styles.badgeCatOther;
  }
}

function severityClass(severity: TicketSeverity | null): string {
  switch (severity) {
    case "Critical":
      return styles.badgeSevCritical;
    case "High":
      return styles.badgeSevHigh;
    case "Medium":
      return styles.badgeSevMedium;
    default:
      return styles.badgeSevLow;
  }
}

function categoryLabel(category: TicketCategory | null): string {
  switch (category) {
    case "FeatureRequest":
      return "Feature";
    case "AccountIssue":
      return "Account";
    default:
      return category ?? "Other";
  }
}

// ── Activity dot color by action ───────────────────────────────────────────

function activityDotColor(action: string): string {
  if (action === "AutoResolved") return "var(--td-green)";
  if (action === "Escalated") return "var(--td-red)";
  if (action === "Classified") return "var(--td-cyan)";
  if (action === "Created") return "var(--td-text-faint)";
  return "var(--td-text-faint)";
}

// ── Format time ────────────────────────────────────────────────────────────

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "";
  }
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

// ── SVG Doughnut Chart ─────────────────────────────────────────────────────

interface DoughnutSlice {
  label: string;
  count: number;
  color: string;
}

function DoughnutChart({ slices }: { slices: DoughnutSlice[] }) {
  const R = 34;
  const C = 2 * Math.PI * R;
  const total = slices.reduce((s, x) => s + x.count, 0);

  if (total === 0) {
    return (
      <div className={styles.doughnutWrap}>
        <svg className={styles.doughnutSvg} viewBox="0 0 80 80">
          <circle cx="40" cy="40" r={R} fill="none" stroke="#1e3a5a" strokeWidth="10" />
        </svg>
        <div className={styles.doughnutLegend}>
          <span className={styles.doughnutLabel} style={{ color: "var(--td-text-faint)" }}>
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
        {/* Track */}
        <circle
          cx="40"
          cy="40"
          r={R}
          fill="none"
          stroke="#1e3a5a"
          strokeWidth="10"
        />
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
              <span
                className={styles.doughnutDot}
                style={{ background: s.color }}
              />
              <span className={styles.doughnutLabel}>{s.label}</span>
              <span className={styles.doughnutCount}>{s.count}</span>
            </div>
          ))}
      </div>
    </div>
  );
}

// ── Dashboard tab ──────────────────────────────────────────────────────────

function DashboardTab({ tickets }: { tickets: Ticket[] }) {
  const total = tickets.length;
  const resolved = tickets.filter((t) => t.status === "AutoResolved").length;
  const escalated = tickets.filter((t) => t.status === "Escalated").length;
  const deflectionRate = total === 0 ? 0 : Math.round((resolved / total) * 100);

  // Category breakdown
  const catCounts: Record<string, number> = {
    Bug: 0,
    FeatureRequest: 0,
    HowTo: 0,
    AccountIssue: 0,
    Other: 0,
  };
  for (const t of tickets) {
    const key = t.category ?? "Other";
    catCounts[key] = (catCounts[key] ?? 0) + 1;
  }

  // Severity breakdown
  const sevCounts: Record<string, number> = {
    Critical: 0,
    High: 0,
    Medium: 0,
    Low: 0,
  };
  for (const t of tickets) {
    const key = t.severity ?? "Low";
    sevCounts[key] = (sevCounts[key] ?? 0) + 1;
  }

  const categorySlices: DoughnutSlice[] = [
    { label: "Bug", count: catCounts.Bug, color: "var(--td-red)" },
    { label: "How To", count: catCounts.HowTo, color: "var(--td-cyan)" },
    { label: "Feature", count: catCounts.FeatureRequest, color: "var(--td-purple)" },
    { label: "Account", count: catCounts.AccountIssue, color: "var(--td-amber)" },
    { label: "Other", count: catCounts.Other, color: "var(--td-text-faint)" },
  ];

  const severitySlices: DoughnutSlice[] = [
    { label: "Critical", count: sevCounts.Critical, color: "var(--td-red)" },
    { label: "High", count: sevCounts.High, color: "var(--td-amber)" },
    { label: "Medium", count: sevCounts.Medium, color: "var(--td-cyan)" },
    { label: "Low", count: sevCounts.Low, color: "var(--td-text-faint)" },
  ];

  return (
    <>
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total tickets</span>
          <span className={styles.statValue}>{total}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Deflection rate</span>
          <span className={`${styles.statValue} ${styles.statValueGreen}`}>
            {deflectionRate}%
          </span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Auto-resolved</span>
          <span className={`${styles.statValue} ${styles.statValueCyan}`}>{resolved}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Escalated</span>
          <span className={`${styles.statValue} ${styles.statValueRed}`}>{escalated}</span>
        </div>
      </div>

      <div className={styles.chartsRow}>
        <div className={styles.chartCard}>
          <p className={styles.chartTitle}>By category</p>
          <DoughnutChart slices={categorySlices} />
        </div>
        <div className={styles.chartCard}>
          <p className={styles.chartTitle}>By severity</p>
          <DoughnutChart slices={severitySlices} />
        </div>
      </div>

      {total === 0 && (
        <div className={styles.empty}>
          No tickets yet. Submit one or run the simulation.
        </div>
      )}
    </>
  );
}

// ── Ticket card ────────────────────────────────────────────────────────────

function TicketCard({ ticket }: { ticket: Ticket }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article className={styles.ticketCard}>
      <div
        className={styles.ticketCardHeader}
        onClick={() => setExpanded((v) => !v)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setExpanded((v) => !v);
        }}
        aria-expanded={expanded}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className={styles.ticketTitle}>{ticket.title}</p>
          <div className={styles.ticketMeta}>
            <span className={styles.ticketMetaItem}>{fmtDate(ticket.createdAt)}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.375rem", flexShrink: 0, alignItems: "flex-start", marginTop: "0.125rem" }}>
          {ticket.category && (
            <span className={`${styles.badge} ${categoryClass(ticket.category)}`}>
              {categoryLabel(ticket.category)}
            </span>
          )}
          {ticket.severity && (
            <span className={`${styles.badge} ${severityClass(ticket.severity)}`}>
              {ticket.severity}
            </span>
          )}
          <span className={`${styles.badge} ${statusClass(ticket.status)}`}>
            {ticket.status}
          </span>
        </div>
        <span
          className={`${styles.expandChevron} ${expanded ? styles.expandChevronOpen : ""}`}
          aria-hidden
        >
          ▾
        </span>
      </div>

      {expanded && (
        <div className={styles.ticketCardBody}>
          <p className={styles.ticketDescription}>{ticket.description}</p>
          {ticket.resolution && (
            <div className={styles.ticketResolution}>
              <p className={styles.ticketResolutionLabel}>Auto-resolution</p>
              <p className={styles.ticketResolutionText}>{ticket.resolution}</p>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

// ── Tickets tab ────────────────────────────────────────────────────────────

function TicketsTab({
  tickets,
  onSubmit,
  onSimulate,
  onClear,
}: {
  tickets: Ticket[];
  onSubmit: (title: string, desc: string) => void;
  onSimulate: () => void;
  onClear: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    onSubmit(title.trim(), description.trim());
    setTitle("");
    setDescription("");
  }

  return (
    <>
      <div className={styles.submitSection}>
        <p className={styles.submitTitle}>Submit a ticket</p>
        <form onSubmit={handleSubmit}>
          <div className={styles.formRow}>
            <input
              className={styles.formInput}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title — e.g. 'Cannot log in after password reset'"
              required
            />
            <textarea
              className={styles.formTextarea}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue in detail…"
              rows={3}
              required
            />
          </div>
          <div className={styles.formActions}>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={!title.trim() || !description.trim()}
            >
              Submit
            </button>
            <button
              type="button"
              className={styles.simulateBtn}
              onClick={onSimulate}
            >
              ⚡ Simulate batch
            </button>
            {tickets.length > 0 && (
              <button
                type="button"
                className={styles.clearBtn}
                onClick={onClear}
              >
                Clear
              </button>
            )}
          </div>
        </form>
      </div>

      <div className={styles.feedHeader}>
        <span className={styles.feedLabel}>Ticket feed</span>
        <span className={styles.feedCount}>{tickets.length} ticket{tickets.length !== 1 ? "s" : ""}</span>
      </div>

      {tickets.length === 0 ? (
        <div className={styles.empty}>No tickets yet. Submit one above or run the simulation.</div>
      ) : (
        <div className={styles.ticketList}>
          {tickets.map((t) => (
            <TicketCard key={t.id} ticket={t} />
          ))}
        </div>
      )}
    </>
  );
}

// ── Activity log tab ───────────────────────────────────────────────────────

function ActivityTab({ log }: { log: ActivityLogEntry[] }) {
  if (log.length === 0) {
    return <div className={styles.empty}>No activity yet. Submit a ticket to see the pipeline in action.</div>;
  }

  return (
    <div className={styles.activityList}>
      {log.map((entry, i) => (
        <div key={entry.id} className={styles.activityEntry}>
          <div className={styles.activityDotCol}>
            <span
              className={styles.activityDot}
              style={{ background: activityDotColor(entry.action) }}
            />
            {i < log.length - 1 && <span className={styles.activityLine} />}
          </div>
          <div className={styles.activityBody}>
            <p className={styles.activityAction}>{entry.action}</p>
            <p className={styles.activityDetails}>{entry.details}</p>
          </div>
          <time className={styles.activityTime}>{fmtTime(entry.timestamp)}</time>
        </div>
      ))}
    </div>
  );
}

// ── Main app ───────────────────────────────────────────────────────────────

type Tab = "dashboard" | "tickets" | "activity";

export default function App() {
  const { tickets, activityLog, hydrated, submitTicket, simulateTickets, clearTickets } =
    useTicketStore();
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");

  if (!hydrated) {
    return (
      <div className={styles.shell}>
        <div className={styles.loading}>initializing pipeline…</div>
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      {/* Tab bar */}
      <div className={styles.tabBar} role="tablist">
        {(["dashboard", "tickets", "activity"] as Tab[]).map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "dashboard" ? "Dashboard" : tab === "tickets" ? "Tickets" : "Activity"}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className={styles.content} role="tabpanel">
        {activeTab === "dashboard" && <DashboardTab tickets={tickets} />}
        {activeTab === "tickets" && (
          <TicketsTab
            tickets={tickets}
            onSubmit={submitTicket}
            onSimulate={simulateTickets}
            onClear={clearTickets}
          />
        )}
        {activeTab === "activity" && <ActivityTab log={activityLog} />}
      </div>
    </div>
  );
}
