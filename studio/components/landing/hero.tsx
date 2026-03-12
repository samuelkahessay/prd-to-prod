import styles from "./hero.module.css";

const ACTS = ["Brief", "Plan", "Build", "Ship", "Heal"];

export function Hero() {
  return (
    <section className={styles.hero}>
      <div className={styles.text}>
        <h1 className={styles.headline}>
          Brief in.
          <span className={styles.line2}>Production out.</span>
        </h1>
        <p className={styles.subtitle}>
          Turns PRDs and meeting notes into reviewed, merged, deployed code.
          Agents build. Policy gates enforce. The system heals itself.
        </p>
        <div>
          <a href="/console" className={styles.ctaPrimary}>See it run</a>
          <a href="/console" className={styles.ctaLink}>Open console →</a>
        </div>
      </div>
      <div className={styles.animation}>
        <span className={styles.placeholderText}>5-act pipeline animation</span>
        <div className={styles.actLabels}>
          {ACTS.map((act, i) => (
            <span key={act} className={i === 0 ? styles.actActive : undefined}>
              {act}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
