import styles from "./pricing.module.css";
import { WaitlistForm } from "./waitlist-form";

export function Pricing() {
  return (
    <section id="pricing" className={styles.section}>
      <span className={styles.label}>Pricing</span>
      <h2 className={styles.heading}>$1. One PRD. One governed pipeline run.</h2>
      <p className={styles.subtitle}>
        Early adopter runs use the same multi-agent pipeline you see in the
        demo. Repo handoff is included. Deploy proof is included when Vercel is
        configured for the run.
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
            <li>You paste a PRD and launch a governed run</li>
            <li>Agents plan, code, review, and merge inside the pipeline</li>
            <li>You get a GitHub repo you own with commit history and workflows pre-wired</li>
            <li>Deploy proof is included when Vercel credentials are configured</li>
            <li>After handoff, you own hosting and follow-on work</li>
            <li>Your repo-side agent loop activates when you add your own compatible LLM key</li>
          </ul>

          <a href="/demo" className={styles.ctaPrimary}>Watch guided demo</a>
          <WaitlistForm />
        </div>

        <div className={styles.card}>
          <p className={styles.cardLabel}>Run it yourself</p>
          <div className={styles.priceTag}>
            $0
          </div>
          <p className={styles.pricePer}>MIT licensed, forever</p>

          <ul className={styles.features}>
            <li>Full pipeline source code</li>
            <li>Bring your own OpenAI-compatible LLM key</li>
            <li>Deploy anywhere — your infra, your rules</li>
            <li>Self-healing, review agents, auto-dispatch</li>
          </ul>

          <div className={styles.needs}>
            <p className={styles.needsTitle}>You need</p>
            <ul className={styles.needsList}>
              <li>GitHub repo + Actions</li>
              <li>LLM access via your own OpenAI-compatible key</li>
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
