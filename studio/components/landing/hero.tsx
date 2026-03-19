import styles from "./hero.module.css";

const MAILTO = "mailto:kahessay@icloud.com?subject=PRD%20Submission";

export function Hero() {
  return (
    <section className={styles.hero}>
      <p className={styles.eyebrow}>Powered by GitHub Agentic Workflows</p>
      <h1 className={styles.headline}>
        Send a PRD.<br />
        Get a deployed app for $1.
      </h1>
      <p className={styles.subtitle}>
        Autonomous agents decompose your PRD into issues, implement each one,
        pass automated review, and deploy to Vercel. You get a GitHub repo you
        own with the full agentic CI/CD pipeline wired in.
      </p>
      <div className={styles.actions}>
        <a href={MAILTO} className={styles.ctaPrimary}>Send your PRD</a>
        <a href="/build?demo=true" className={styles.ctaSecondary}>Watch it build</a>
      </div>
      <p className={styles.scope}>
        Web apps only. Next.js, Express, Node.
      </p>
    </section>
  );
}
