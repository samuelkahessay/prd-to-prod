"use client";

import type { QueueItem } from "@/lib/types";
import styles from "./queue-panel.module.css";

interface QueuePanelProps {
  items: QueueItem[];
  onResolve: (id: string, resolution: "approved" | "rejected") => void;
}

export function QueuePanel({ items, onResolve }: QueuePanelProps) {
  return (
    <div className={styles.panel}>
      <h3 className={styles.heading}>
        Awaiting human decision
        <span className={styles.count}>{items.length}</span>
      </h3>
      {items.map((item) => (
        <div key={item.id} className={styles.item}>
          <div className={styles.event}>{item.event}</div>
          <div className={styles.reason}>{item.reason}</div>
          <div className={styles.meta}>
            {item.policyRule && <span className={styles.policy}>{item.policyRule}</span>}
            <span className={styles.time}>queued {item.queuedAt}</span>
          </div>
          <div className={styles.actions}>
            <button className={styles.approve} onClick={() => onResolve(item.id, "approved")}>
              Approve
            </button>
            <button className={styles.reject} onClick={() => onResolve(item.id, "rejected")}>
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
