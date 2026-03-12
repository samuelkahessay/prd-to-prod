import styles from "./bottom-cta.module.css";

export function BottomCta() {
  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>See the pipeline run.</h2>
      <p className={styles.body}>
        Open the console to launch a run, inspect decisions, or browse the
        audit trail.
      </p>
      <a href="/console" className={styles.ctaPrimary}>Open console</a>
      <a
        href="https://github.com/samuelkahessay/prd-to-prod"
        className={styles.ctaLink}
        target="_blank"
        rel="noopener"
      >
        View on GitHub →
      </a>
    </section>
  );
}
