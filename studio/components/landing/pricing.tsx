import styles from "./pricing.module.css";

export function Pricing() {
  return (
    <section id="pricing" className={styles.section}>
      <span className={styles.label}>Pricing</span>
      <h2 className={styles.heading}>$1. One PRD. One deployed app.</h2>
      <p className={styles.subtitle}>
        We&apos;re building case studies with early adopters on Platform Calgary.
        For $1, you get a real pipeline run — same agents, same CI/CD, same
        deployment.
      </p>

      <div className={styles.cards}>
        <div className={`${styles.card} ${styles.cardPrimary}`}>
          <div className={styles.badge}>Early adopter</div>
          <p className={styles.cardLabel}>$1 pipeline run</p>
          <div className={styles.priceTag}>
            $1
          </div>
          <p className={styles.pricePer}>per pipeline run</p>

          <ul className={styles.features}>
            <li>You send a PRD</li>
            <li>Agents build, review, and deploy autonomously</li>
            <li>You get a GitHub repo you own — full commit history, CI/CD, agentic workflows pre-wired</li>
            <li>Live deployment on Vercel for 30 days</li>
            <li>After 30 days, you take over hosting (Vercel free tier works for most projects)</li>
            <li>The agentic pipeline in your repo activates when you add your own Copilot token</li>
          </ul>

          <a href="/build" className={styles.ctaPrimary}>Send your PRD</a>
        </div>

        <div className={styles.card}>
          <p className={styles.cardLabel}>Run it yourself</p>
          <div className={styles.priceTag}>
            $0
          </div>
          <p className={styles.pricePer}>MIT licensed, forever</p>

          <ul className={styles.features}>
            <li>Full pipeline source code</li>
            <li>Bring your own LLM (Copilot, Claude, Codex, Gemini)</li>
            <li>Deploy anywhere — your infra, your rules</li>
            <li>Self-healing, review agents, auto-dispatch</li>
          </ul>

          <div className={styles.needs}>
            <p className={styles.needsTitle}>You need</p>
            <ul className={styles.needsList}>
              <li>GitHub repo + Actions</li>
              <li>LLM access (Copilot, Claude, etc.)</li>
              <li>Hosting (Vercel, Fly, etc.)</li>
            </ul>
          </div>

          <a
            href="https://github.com/samuelkahessay/prd-to-prod"
            className={styles.ctaOutline}
            target="_blank"
            rel="noopener"
          >
            View on GitHub
          </a>
        </div>
      </div>

      <div className={styles.scope}>
        <p className={styles.scopeTitle}>Scope</p>
        <p className={styles.scopeBody}>
          Web apps. Next.js, Express, Node.js. Best fit for new products and
          isolated builds. No mobile, no desktop.
        </p>
      </div>
    </section>
  );
}
