import styles from "./bottom-cta.module.css";

export function BottomCta() {
  return (
    <footer className={styles.section}>
      <h2 className={styles.heading}>Let&apos;s talk about your project.</h2>
      <p className={styles.body}>
        15 minutes. Tell me what you&apos;re building, I&apos;ll tell you if the
        pipeline is a fit.
      </p>
      <a
        href="https://calendly.com/kahessay"
        className={styles.ctaPrimary}
        target="_blank"
        rel="noopener"
      >
        Book a call
      </a>
      <p className={styles.email}>or email kahessay@icloud.com</p>
      <div className={styles.links}>
        <a href="/pitch">Full pitch deck →</a>
        <a href="/vision">Technical vision →</a>
        <a
          href="https://github.com/samuelkahessay/prd-to-prod"
          target="_blank"
          rel="noopener"
        >
          GitHub →
        </a>
        <a
          href="https://linkedin.com/in/samuelkahessay"
          target="_blank"
          rel="noopener"
        >
          LinkedIn →
        </a>
      </div>
    </footer>
  );
}
