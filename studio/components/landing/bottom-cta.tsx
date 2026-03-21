import styles from "./bottom-cta.module.css";

export function BottomCta() {
  return (
    <footer className={styles.section}>
      <h2 className={styles.heading}>Send a PRD. Get a deployed app. $1.</h2>
      <p className={styles.body}>
        Email your PRD — a doc, a rough brief, a few paragraphs. We reply with
        scope and a timeline.
      </p>
      <a href="/build" className={styles.ctaPrimary}>Send your PRD</a>
      <a
        href="https://github.com/samuelkahessay/prd-to-prod"
        className={styles.ctaLink}
        target="_blank"
        rel="noopener"
      >
        View on GitHub
      </a>
    </footer>
  );
}
