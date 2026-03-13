import styles from "./bottom-cta.module.css";

const MAILTO = "mailto:sam@skahessay.dev?subject=PRD%20Submission";

export function BottomCta() {
  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>Ready to ship something?</h2>
      <p className={styles.body}>
        Send us a PRD, a rough brief, or even just an idea. We'll reply with
        scope, timeline, and price. First project free.
      </p>
      <a href={MAILTO} className={styles.ctaPrimary}>Send your PRD →</a>
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
