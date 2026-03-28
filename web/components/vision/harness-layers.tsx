"use client";

import styles from "./harness-layers.module.css";

interface Layer {
  label: string;
  description: string;
  color?: string;
}

export function HarnessLayers({ layers }: { layers: Layer[] }) {
  return (
    <div className={styles.stack} role="list">
      {layers.map((layer, i) => (
        <div
          key={layer.label}
          className={styles.layer}
          role="listitem"
          tabIndex={0}
          style={{ "--layer-accent": layer.color || "var(--ink-faint)" } as React.CSSProperties}
        >
          <div className={styles.bar}>
            <span className={styles.index}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className={styles.label}>{layer.label}</span>
            <span className={styles.expand} aria-hidden="true">
              +
            </span>
          </div>
          <div className={styles.detail}>
            <p>{layer.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
