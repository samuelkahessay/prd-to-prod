import styles from "./how-it-works.module.css";

const STEPS = [
  {
    label: "Plan",
    title: "Brief decomposes into issues",
    body: "A PRD, transcript, or description is analyzed and broken into scoped GitHub issues — each with acceptance criteria the system can verify.",
  },
  {
    label: "Implement",
    title: "Agents build, review, merge",
    body: "Each issue is picked up by a specialized agent. It implements, opens a PR, passes automated review. Policy gates block anything that needs human sign-off.",
  },
  {
    label: "Recover",
    title: "Failures become work items",
    body: "CI failures are detected, diagnosed, and fixed through the same pipeline. The system treats its own failures as new issues.",
    boundary: true,
  },
];

export function HowItWorks() {
  return (
    <section className={styles.section}>
      <span className={styles.num}>01</span>
      <h2 className={styles.heading}>Three stages. Zero handoffs.</h2>
      <div className={styles.steps}>
        {STEPS.map((step, i) => (
          <div
            key={step.label}
            className={`${styles.step} ${i === 2 ? styles.recover : ""}`}
          >
            <div
              className={styles.label}
              data-variant={
                i === 0 ? "accent" : i === 1 ? "muted" : "heal"
              }
            >
              {step.label}
            </div>
            <h3 className={styles.title}>{step.title}</h3>
            <p className={styles.body}>{step.body}</p>
            {step.boundary && (
              <div className={styles.boundary}>
                <span className={styles.blocked}>BLOCKED</span> deploy to
                production
                <br />
                <span className={styles.policyTag}>policy:</span> requires
                human approval
                <br />
                owner: operator@team · queued 2m ago
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
