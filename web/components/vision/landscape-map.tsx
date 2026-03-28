"use client";

import styles from "./landscape-map.module.css";

interface Company {
  name: string;
  x: number;
  y: number;
  detail: string;
  highlight?: boolean;
}

export function LandscapeMap({
  companies,
  xLabel = "Pipeline depth →",
  yLabel = "↑ Human boundary",
}: {
  companies: Company[];
  xLabel?: string;
  yLabel?: string;
}) {
  return (
    <div
      className={styles.map}
      role="img"
      aria-label="Competitive landscape positioning map"
    >
      <div className={styles.yLabel}>{yLabel}</div>
      <div className={styles.xLabel}>{xLabel}</div>

      <div className={styles.grid}>
        <div className={`${styles.gridLine} ${styles.h}`} style={{ bottom: "25%" }} />
        <div className={`${styles.gridLine} ${styles.h}`} style={{ bottom: "50%" }} />
        <div className={`${styles.gridLine} ${styles.h}`} style={{ bottom: "75%" }} />
        <div className={`${styles.gridLine} ${styles.v}`} style={{ left: "25%" }} />
        <div className={`${styles.gridLine} ${styles.v}`} style={{ left: "50%" }} />
        <div className={`${styles.gridLine} ${styles.v}`} style={{ left: "75%" }} />

        {companies.map((c) => (
          <span
            key={c.name}
            className={`${styles.dot} ${c.highlight ? styles.highlight : ""}`}
            style={{ left: `${c.x}%`, bottom: `${c.y}%` }}
            data-tooltip={c.detail}
            tabIndex={0}
            role="button"
            aria-label={`${c.name}: ${c.detail}`}
          >
            <span className={styles.marker} />
            <span className={styles.label}>{c.name}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
