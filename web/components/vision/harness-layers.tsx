import type { CSSProperties } from "react";
import styles from "./harness-layers.module.css";

interface Layer {
  label: string;
  description: string;
  color?: string;
}

export function HarnessLayers({ layers }: { layers: readonly Layer[] }) {
  return (
    <div className={styles.stack} role="list" aria-label="Harness layers">
      {layers.map((layer, index) => (
        <div
          key={layer.label}
          className={styles.layer}
          role="listitem"
          style={{ "--layer-accent": layer.color || "var(--ink-faint)" } as CSSProperties}
        >
          <span className={styles.index}>{String(index + 1).padStart(2, "0")}</span>

          <div className={styles.copy}>
            <p className={styles.label}>{layer.label}</p>
            <p className={styles.description}>{layer.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
