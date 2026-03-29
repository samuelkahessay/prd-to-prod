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
  xLabel = "Pipeline depth",
  yLabel = "Human control boundary",
}: {
  companies: readonly Company[];
  xLabel?: string;
  yLabel?: string;
}) {
  return (
    <div className={styles.frame}>
      <div
        className={styles.map}
        role="img"
        aria-label="Competitive landscape positioning map"
      >
        <div className={styles.yLabel}>{yLabel}</div>
        <div className={styles.xLabel}>{xLabel}</div>

        <div className={styles.grid}>
          <div className={`${styles.gridLine} ${styles.h}`} aria-hidden="true" style={{ bottom: "25%" }} />
          <div className={`${styles.gridLine} ${styles.h}`} aria-hidden="true" style={{ bottom: "50%" }} />
          <div className={`${styles.gridLine} ${styles.h}`} aria-hidden="true" style={{ bottom: "75%" }} />
          <div className={`${styles.gridLine} ${styles.v}`} aria-hidden="true" style={{ left: "25%" }} />
          <div className={`${styles.gridLine} ${styles.v}`} aria-hidden="true" style={{ left: "50%" }} />
          <div className={`${styles.gridLine} ${styles.v}`} aria-hidden="true" style={{ left: "75%" }} />

          {companies.map((company) => (
            <span
              key={company.name}
              className={`${styles.dot} ${company.highlight ? styles.highlight : ""}`}
              style={{ left: `${company.x}%`, bottom: `${company.y}%` }}
              data-tooltip={company.detail}
              tabIndex={0}
              aria-label={`${company.name}: ${company.detail}`}
            >
              <span className={styles.marker} />
              <span className={styles.label}>{company.name}</span>
            </span>
          ))}
        </div>
      </div>

      <div className={styles.legend} role="list" aria-label="Competitive landscape details">
        {companies.map((company) => (
          <div
            key={`${company.name}-legend`}
            className={`${styles.legendItem} ${company.highlight ? styles.legendHighlight : ""}`}
            role="listitem"
          >
            <strong>{company.name}</strong>
            <span>{company.detail}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
