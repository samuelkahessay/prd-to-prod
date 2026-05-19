import styles from "./hero.module.css";

export function Hero() {
  return (
    <section className={styles.hero}>
      <p className={styles.eyebrow}>Autonomous delivery infrastructure</p>
      <h1 className={styles.headline}>
        Code generation is solved.<br />
        Delivery isn&apos;t.
      </h1>
      <p className={styles.subtitle}>
        AI agents can write code — but shipping software requires spec
        decomposition, independent review, deployment, CI repair, and audit
        trails. We build the orchestration layer that governs the full pipeline.
      </p>
      <div className={styles.actions}>
        <a href="/vision" className={styles.ctaPrimary}>
          Read the full thesis →
        </a>
      </div>
    </section>
  );
}
