import { PipelineAnimation } from "./pipeline-animation";
import styles from "./how-it-works.module.css";

const STEPS = [
  { num: "01", title: "Decompose", body: "PRD to scoped GitHub issues with acceptance criteria", color: "accent" },
  { num: "02", title: "Build", body: "Agents implement each issue, open PRs with tests", color: "accent" },
  { num: "03", title: "Review", body: "Automated code review verifies against the spec. Policy gates enforce human boundaries.", color: "policy" },
  { num: "04", title: "Ship", body: "Approved PRs deploy to production", color: "good" },
  { num: "05", title: "Heal", body: "CI failures are detected and routed back through the pipeline as new issues", color: "good" },
];

const STEP_CLASS: Record<string, string> = {
  policy: styles.stepPolicy,
  good: styles.stepGood,
};

const NUM_CLASS: Record<string, string> = {
  accent: styles.stepNumAccent,
  policy: styles.stepNumPolicy,
  good: styles.stepNumGood,
};

export function HowItWorks() {
  return (
    <section id="how-it-works" className={styles.section}>
      <div className={styles.labelRow}>
        <span className={styles.label}>How it works</span>
        <span className={styles.dot}>&middot;</span>
        <span className={styles.labelGhaw}>Powered by GitHub Agentic Workflows</span>
      </div>
      <h2 className={styles.heading}>
        Agents build the app. Policy controls the boundaries.
      </h2>
      <p className={styles.subtitle}>
        Your PRD is decomposed into scoped issues. Agents implement each one,
        open PRs, pass automated review. Human approval gates enforce where
        the boundary is.
      </p>

      <div className={styles.animation}>
        <PipelineAnimation />
      </div>

      <div className={styles.steps}>
        {STEPS.map((step) => (
          <div
            key={step.num}
            className={`${styles.step} ${STEP_CLASS[step.color] || ""}`}
          >
            <p className={`${styles.stepNum} ${NUM_CLASS[step.color] || ""}`}>
              {step.num}
            </p>
            <p className={styles.stepTitle}>{step.title}</p>
            <p className={styles.stepBody}>{step.body}</p>
          </div>
        ))}
      </div>

      <div className={styles.credibility}>
        <p className={styles.credibilityBody}>
          Built on <strong>GitHub Agentic Workflows</strong> — an open framework
          from GitHub for autonomous development workflows. 31 upstream findings
          filed, 17 fixes shipped across 7 releases.
        </p>
      </div>
    </section>
  );
}
