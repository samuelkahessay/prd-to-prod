import type { EvidenceRow } from "@/lib/types";
import styles from "./evidence-ledger.module.css";

const OUTCOME_CLASS: Record<string, string> = {
  running: styles.live,
  merged: styles.merged,
  healed: styles.healed,
  blocked: styles.blocked,
  drill: styles.drill,
};

const OUTCOME_LABEL: Record<string, string> = {
  running: "● running",
  merged: "● merged",
  healed: "● healed",
  blocked: "● blocked",
  drill: "○ drill",
};

export function EvidenceLedger({ rows }: { rows: EvidenceRow[] }) {
  if (rows.length === 0) {
    return (
      <section className={styles.section}>
        <span className={styles.num}>03</span>
        <h2 className={styles.heading}>Inspect the work.</h2>
        <p className={styles.empty}>Recent activity unavailable.</p>
      </section>
    );
  }

  return (
    <section className={styles.section}>
      <span className={styles.num}>03</span>
      <h2 className={styles.heading}>Inspect the work.</h2>
      <p className={styles.subtitle}>
        This system builds itself. Every feature on this site was implemented,
        reviewed, and deployed by the pipeline.
      </p>
      <div className={styles.ledger}>
        <div className={styles.header}>
          <span>Time</span>
          <span>Event</span>
          <span>Duration</span>
          <span>Outcome</span>
        </div>
        {rows.map((row, i) => (
          <div key={i} className={`${styles.row} ${i === 0 ? styles.featured : ""}`}>
            <span className={styles.time}>{row.time}</span>
            <span className={styles.event}>
              {row.event}
              {row.refs.map((ref) => (
                <a
                  key={ref.label}
                  href={ref.url}
                  className={`${styles.ref} ${
                    ref.type === "heal" ? styles.refHeal :
                    ref.type === "policy" ? styles.refPolicy : ""
                  }`}
                  target="_blank"
                  rel="noopener"
                >
                  {ref.label}
                </a>
              ))}
            </span>
            <span className={styles.duration}>{row.duration || "—"}</span>
            <span className={`${styles.outcome} ${OUTCOME_CLASS[row.outcome] || ""}`}>
              {OUTCOME_LABEL[row.outcome] || row.outcome}
            </span>
          </div>
        ))}
        <div className={styles.footer}>
          Showing {rows.length} events ·{" "}
          <a href="https://github.com/samuelkahessay/prd-to-prod" target="_blank" rel="noopener">
            Open on GitHub →
          </a>
        </div>
      </div>
    </section>
  );
}
