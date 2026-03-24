import { PipelineAnimation } from "./pipeline-animation";
import styles from "./how-it-works.module.css";

const STEPS = [
  { num: "01", title: "Paste PRD", body: "Start from a rough brief or a full product requirements doc", color: "accent" },
  { num: "02", title: "Agents plan", body: "The planner decomposes the brief into issues and queues the room", color: "accent" },
  { num: "03", title: "Agents code", body: "Implementation agents open PRs, react to checks, and keep the floor moving", color: "accent" },
  { num: "04", title: "Review and merge", body: "The reviewer inspects the work while policy keeps the final boundary human-owned", color: "policy" },
  { num: "05", title: "Repo proof", body: "Repo handoff always. Deploy proof when Vercel is configured", color: "good" },
];
const HUMAN_BOUNDARY_URL =
  "https://github.com/samuelkahessay/prd-to-prod/blob/main/autonomy-policy.yml";

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
        Paste the PRD. Then watch the room work.
      </h2>
      <p className={styles.subtitle}>
        The public path is simple: shape the brief, launch the guided demo or a
        governed run, then cut to repo proof and optional deploy proof.
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
          from GitHub for autonomous development workflows. The floor is the
          interface layer; the repo and policy boundary keep the system honest.
        </p>
      </div>

      <div className={styles.boundaryCard}>
        <div className={styles.boundaryHeader}>
          <p className={styles.boundaryLabel}>Human boundary</p>
          <a
            className={styles.boundaryLink}
            href={HUMAN_BOUNDARY_URL}
            rel="noopener noreferrer"
            target="_blank"
          >
            Read the autonomy policy
          </a>
        </div>
        <div className={styles.boundaryGrid}>
          <div className={styles.boundaryBlock}>
            <p className={styles.boundaryTitle}>Humans own</p>
            <p className={styles.boundaryBody}>
              Access codes, secrets, deploy routing, workflow authority, and
              any expansion of scope.
            </p>
          </div>
          <div className={styles.boundaryBlock}>
            <p className={styles.boundaryTitle}>Agents own</p>
            <p className={styles.boundaryBody}>
              Bounded implementation inside the repo once the run is authorized
              and the PRD is locked.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
