import styles from "./pipeline.module.css";

const STEPS = [
  {
    num: "01",
    title: "Brief intake",
    body: "File a product brief as a GitHub issue. Plain language, rough scope — the pipeline structures it.",
  },
  {
    num: "02",
    title: "Decompose into tasks",
    body: "Planner agent breaks the brief into parallel issues with dependency ordering.",
  },
  {
    num: "03",
    title: "Agents implement",
    body: "Builder agents open PRs, react to CI checks, and keep the repo moving.",
  },
  {
    num: "04",
    title: "Independent review",
    body: "A separate reviewer agent inspects every PR. Identity separation — builder ≠ approver.",
  },
  {
    num: "05",
    title: "Deploy and self-heal",
    body: "Merge, deploy, and if CI breaks, agents detect, diagnose, and repair autonomously.",
  },
];

export function Pipeline() {
  return (
    <section id="how-it-works" className={styles.section}>
      <h2 className={styles.heading}>The pipeline</h2>
      <p className={styles.subheading}>
        A product brief goes in. A deployed, governed repo comes out.
      </p>
      <div className={styles.steps}>
        {STEPS.map((step) => (
          <div key={step.num} className={styles.step}>
            <span className={styles.num}>{step.num}</span>
            <div>
              <h3 className={styles.title}>{step.title}</h3>
              <p className={styles.body}>{step.body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
