import type { Run } from "@/lib/types";
import styles from "./runs-table.module.css";

const STATUS_CLASS: Record<string, string> = {
  queued: styles.queued,
  running: styles.running,
  completed: styles.completed,
  failed: styles.failed,
};

function formatDuration(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

export function RunsTable({ runs }: { runs: Run[] }) {
  if (runs.length === 0) {
    return (
      <div className={styles.empty}>
        <p>No runs yet. Launch one above.</p>
      </div>
    );
  }

  return (
    <div className={styles.table}>
      <div className={styles.header}>
        <span>#</span>
        <span>Summary</span>
        <span>Started</span>
        <span>Duration</span>
        <span>Status</span>
      </div>
      {runs.map((run, i) => (
        <a key={run.id} href={`/console/runs/${run.id}`} className={`${styles.row} ${i === 0 && run.status === "running" ? styles.active : ""}`}>
          <span className={styles.num}>{run.id.slice(0, 4)}</span>
          <span className={styles.summary}>{run.summary || run.inputSource}</span>
          <span className={styles.time}>{new Date(run.createdAt).toLocaleString()}</span>
          <span className={styles.duration}>
            {run.status === "completed" || run.status === "failed"
              ? formatDuration(run.createdAt, run.updatedAt)
              : "—"}
          </span>
          <span className={`${styles.status} ${STATUS_CLASS[run.status] || ""}`}>
            ● {run.status}
          </span>
        </a>
      ))}
    </div>
  );
}
