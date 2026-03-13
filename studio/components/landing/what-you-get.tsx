import styles from "./what-you-get.module.css";

const DELIVERABLES = [
  {
    title: "A real repo",
    body: "Your own GitHub repository with clean commit history, PR-reviewed code, and full version control. Not locked in a platform.",
  },
  {
    title: "CI/CD from day one",
    body: "Every project ships with automated builds, tests, and deployment. Not a prototype you still need to operationalize.",
  },
  {
    title: "It stays healthy",
    body: "CI failures are detected, diagnosed, and fixed through the same pipeline. The system treats its own failures as work items.",
  },
];

export function WhatYouGet() {
  return (
    <section className={styles.section}>
      <span className={styles.label}>What you get</span>
      <h2 className={styles.heading}>Not a prototype. A deployed product.</h2>
      <p className={styles.subtitle}>
        Tools like Bolt and Lovable help you prototype quickly. This gives you
        a deployed app, a real repo, and CI/CD from day one.
      </p>
      <div className={styles.grid}>
        {DELIVERABLES.map((d) => (
          <div key={d.title} className={styles.item}>
            <h3 className={styles.itemTitle}>{d.title}</h3>
            <p className={styles.itemBody}>{d.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
