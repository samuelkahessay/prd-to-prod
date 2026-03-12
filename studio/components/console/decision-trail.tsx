import type { Decision } from "@/lib/types";
import styles from "./decision-trail.module.css";

const TYPE_CLASS: Record<string, string> = { auto: styles.auto, blocked: styles.blocked, human: styles.human, system: styles.system };

export function DecisionTrail({ entries }: { entries: Decision[] }) {
  if (entries.length === 0) return <p className={styles.empty}>No decisions recorded.</p>;
  return (
    <div className={styles.trail}>
      {entries.map((entry, i) => (
        <div key={i} className={styles.entry}>
          <span className={`${styles.dot} ${TYPE_CLASS[entry.type] || ""}`} />
          <span className={styles.time}>{new Date(entry.timestamp).toLocaleTimeString()}</span>
          <span className={styles.event}>{entry.event}</span>
          <span className={styles.detail}>{entry.detail}</span>
          {entry.policyRef && <span className={styles.policy}>{entry.policyRef}</span>}
          {entry.resolution && <span className={`${styles.resolution} ${entry.resolution === "approved" ? styles.approved : styles.rejected}`}>{entry.resolution}</span>}
        </div>
      ))}
    </div>
  );
}
