import styles from "./hero.module.css";

const MAILTO = "mailto:kahessay@icloud.com?subject=PRD%20Submission";

export function Hero() {
  return (
    <section className={styles.hero}>
      <p className={styles.eyebrow}>Powered by GitHub Agentic Workflows</p>
      <h1 className={styles.headline}>
        Send a PRD.
        <span className={styles.line2}>Get a deployed app.</span>
      </h1>
      <p className={styles.subtitle}>
        Autonomous agents build, review, and deploy your app from your PRD.
        You get a live URL, a real repo with CI/CD, and code you own.
        Open source. First run free.
      </p>
      <div className={styles.actions}>
        <a href={MAILTO} className={styles.ctaPrimary}>Send your PRD →</a>
        <a href="#pricing" className={styles.ctaLink}>See pricing</a>
      </div>
    </section>
  );
}
