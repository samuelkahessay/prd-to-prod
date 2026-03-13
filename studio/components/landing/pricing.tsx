import styles from "./pricing.module.css";

const MAILTO = "mailto:sam@skahessay.dev?subject=PRD%20Submission";

export function Pricing() {
  return (
    <section id="pricing" className={styles.section}>
      <span className={styles.label}>Pricing</span>
      <h2 className={styles.heading}>Pricing</h2>
      <p className={styles.subtitle}>
        The pipeline is open source. You're paying for compute, hosting,
        and the operational expertise to keep it running.
      </p>

      <div className={styles.cards}>
        {/* Card A — Managed runs (primary) */}
        <div className={`${styles.card} ${styles.cardPrimary}`}>
          <div className={styles.badge}>Most popular</div>
          <p className={styles.cardLabel}>We run it for you</p>
          <div className={styles.price}>
            $99<span className={styles.priceUnit}>–$499</span>
          </div>
          <p className={styles.pricePer}>per pipeline run</p>

          <ul className={styles.features}>
            <li>✓ Send a PRD, get a deployed app</li>
            <li>✓ All LLM compute included</li>
            <li>✓ Deployed on Vercel with CI/CD</li>
            <li>✓ Real repo you own — code, history, everything</li>
            <li>✓ Self-healing CI included</li>
            <li className={styles.featureMuted}>~ 24–48 hour turnaround</li>
          </ul>

          <div className={styles.tiers}>
            <p className={styles.tiersTitle}>Complexity tiers</p>
            <div className={styles.tier}>
              <span>Simple app / internal tool</span>
              <span className={styles.tierPrice}>$99</span>
            </div>
            <div className={styles.tier}>
              <span>Multi-feature with integrations</span>
              <span className={styles.tierPrice}>$249</span>
            </div>
            <div className={styles.tier}>
              <span>Complex (auth, multiple APIs)</span>
              <span className={styles.tierPrice}>$499</span>
            </div>
          </div>

          <a href={MAILTO} className={styles.ctaPrimary}>Send your PRD →</a>
          <p className={styles.subCta}>First run free — no card required</p>
        </div>

        {/* Card B — Self-hosted (secondary) */}
        <div id="for-teams" className={styles.card}>
          <p className={styles.cardLabel}>Run it yourself</p>
          <div className={styles.price}>
            $0
          </div>
          <p className={styles.pricePer}>MIT licensed, forever</p>

          <ul className={styles.features}>
            <li>✓ Full pipeline source code</li>
            <li>✓ Bring your own LLM (Copilot, Claude, Codex, Gemini)</li>
            <li>✓ Deploy anywhere — your infra, your rules</li>
            <li>✓ Self-healing, review agents, auto-dispatch</li>
            <li>✓ Same code that runs our managed service</li>
          </ul>

          <div className={styles.tiers}>
            <p className={styles.tiersTitle}>You'll need</p>
            <div className={styles.tier}>
              <span>GitHub repo + Actions</span>
              <span className={styles.tierPrice}>free</span>
            </div>
            <div className={styles.tier}>
              <span>LLM access (Copilot, Claude, etc.)</span>
              <span className={styles.tierPrice}>~$19/mo</span>
            </div>
            <div className={styles.tier}>
              <span>Hosting (Vercel, Fly, etc.)</span>
              <span className={styles.tierPrice}>~$0–20/mo</span>
            </div>
          </div>

          <a
            href="https://github.com/samuelkahessay/prd-to-prod"
            className={styles.ctaOutline}
            target="_blank"
            rel="noopener"
          >
            View on GitHub →
          </a>
          <p className={styles.subCta}>Optional support from $299/mo</p>
        </div>
      </div>

      <div className={styles.scope}>
        <p className={styles.scopeTitle}>What's in scope today</p>
        <p className={styles.scopeBody}>
          Web apps (Next.js, Express, Node.js). Best fit for new products and
          isolated builds. No mobile, no desktop, no complex infrastructure.
          We're upfront about boundaries because the pipeline is honest about
          what it can deliver.
        </p>
      </div>
    </section>
  );
}
