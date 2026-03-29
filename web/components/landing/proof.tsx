import styles from "./proof.module.css";

const METRICS = [
  { value: "80", label: "PRs merged" },
  { value: "133", label: "issues" },
  { value: "12", label: "modules" },
  { value: "6", label: "days" },
];

export function Proof() {
  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>Built with the pipeline</h2>

      <div className={styles.caseStudy}>
        <p className={styles.caseLabel}>First client build</p>
        <h3 className={styles.caseTitle}>Aurrin Ventures Crowdfunding Platform</h3>
        <p className={styles.caseBody}>
          Calgary accelerator replacing their static site with a 12-module
          platform for founders to build in public and raise money. From idea to
          working product in 6 days — 80 agent-merged PRs across 133 issues.
        </p>
        <div className={styles.metrics}>
          {METRICS.map((m) => (
            <div key={m.label} className={styles.metric}>
              <strong>{m.value}</strong> <span>{m.label}</span>
            </div>
          ))}
        </div>
      </div>

      <ul className={styles.credibility}>
        <li>
          <strong>Top 3 contributor</strong> to GitHub Agentic Workflows — 28
          issues filed, 15 credited by name across 8 releases
        </li>
        <li>
          <strong>Open source, MIT licensed</strong> — full pipeline source code.
          You own the repo, the pipeline, and the governance layer.
        </li>
      </ul>
    </section>
  );
}
