import styles from "./audience.module.css";

export function Audience() {
  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>Who this is for</h2>

      <div className={styles.cards}>
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Founders with ideas</h3>
          <p className={styles.cardBody}>
            You have a product brief or a clear idea. You need it built and
            deployed — not a prototype, a real repo with CI, review, and a deploy
            pipeline you own.
          </p>
        </div>
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Teams starting new projects</h3>
          <p className={styles.cardBody}>
            You have engineers but want to start agent-first. We install the
            pipeline in your repo, run a proof-of-concept, and hand off the
            governance layer.
          </p>
        </div>
      </div>

      <div className={styles.convergence}>
        <p>
          <strong>Where the industry is heading:</strong> GitHub shipped Agentic
          Workflows. Vercel added Mitchell Hashimoto to the board. Factory raised
          $70M from Sequoia. The infrastructure layer for autonomous delivery is
          being built right now — and we&apos;re one of the deepest
          implementations running in production.
        </p>
      </div>
    </section>
  );
}
