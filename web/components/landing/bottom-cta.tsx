import styles from "./bottom-cta.module.css";

export function BottomCta() {
  return (
    <footer className={styles.section}>
      <h2 className={styles.heading}>Build from the source.</h2>
      <p className={styles.body}>
        Explore the working repo, the delivery thesis, and the first client
        build that proved the loop under real pressure.
      </p>
      <div className={styles.links}>
        <a href="/vision">Technical vision →</a>
        <a href="/case-studies/aurrin-ventures">Case study →</a>
        <a
          href="https://github.com/samuelkahessay/prd-to-prod"
          target="_blank"
          rel="noopener"
        >
          View on GitHub →
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
