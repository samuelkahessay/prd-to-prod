import type { Run } from "@/lib/types";
import styles from "./artifacts-list.module.css";

export function ArtifactsList({ run }: { run: Run }) {
  const artifacts = (run.events || []).filter((e) => e.kind === "artifact").map((e) => ({ key: e.data?.key as string, value: e.data?.value as string }));
  if (artifacts.length === 0) return <p className={styles.empty}>No artifacts yet.</p>;
  return (
    <div className={styles.list}>
      {artifacts.map((a, i) => (
        <div key={i} className={styles.item}>
          <span className={styles.key}>{a.key}</span>
          <span className={styles.value}>{a.value}</span>
        </div>
      ))}
    </div>
  );
}
