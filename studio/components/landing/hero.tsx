import { PipelineAnimation } from "./pipeline-animation";
import styles from "./hero.module.css";

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
        <PipelineAnimation />
      </div>
    </section>
  );
}
