import type { PreflightCheck } from "@/lib/types";
import styles from "./preflight-panel.module.css";

export function PreflightPanel({ checks }: { checks: PreflightCheck[] }) {
  if (checks.length === 0) {
    return (
      <div className={styles.panel}>
        <h4 className={styles.heading}>Preflight</h4>
        <p className={styles.empty}>No checks available</p>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <h4 className={styles.heading}>Preflight</h4>
      {checks.map((check) => (
        <div key={check.id} className={styles.check}>
          <span className={`${styles.dot} ${check.present ? styles.ok : check.required ? styles.warn : styles.off}`} />
          <span className={styles.name}>{check.name}</span>
          {check.required && !check.present && <span className={styles.required}>required</span>}
        </div>
      ))}
    </div>
  );
}
