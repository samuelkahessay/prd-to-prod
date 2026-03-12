import styles from "./contrast-list.module.css";

const CONTRASTS = [
  {
    not: "A chatbot that writes code when you ask",
    is: "A pipeline that owns the loop from brief to deploy",
  },
  {
    not: "One-shot generation you still have to ship yourself",
    is: "Multi-agent orchestration through PR, CI, review, and merge",
  },
  {
    not: "Autonomous with no guardrails",
    is: "Bounded by policy — human decisions are enforced, not optional",
  },
  {
    not: "A demo that works once",
    is: "Self-healing — failures are routed through the same pipeline",
  },
];

export function ContrastList() {
  return (
    <section className={styles.section}>
      <span className={styles.num}>02</span>
      <h2 className={styles.heading}>Not another code generator.</h2>
      <div className={styles.list}>
        {CONTRASTS.map((pair, i) => (
          <div key={i}>
            <div className={styles.row}>
              <span className={`${styles.tag} ${styles.not}`}>Not</span>
              <span className={`${styles.text} ${styles.muted}`}>{pair.not}</span>
            </div>
            <div className={styles.row}>
              <span className={`${styles.tag} ${styles.is}`}>Is</span>
              <span className={`${styles.text} ${styles.strong}`}>{pair.is}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
