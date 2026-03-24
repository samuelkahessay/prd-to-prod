import styles from "./what-you-get.module.css";

const DELIVERABLES = [
  {
    title: "A guided factory-floor demo",
    body: "Five distinct agents react to real pipeline events on a shared isometric floor before the proof endcap lands.",
  },
  {
    title: "A real repo handoff",
    body: "Your own GitHub repository with clean history, reviewable PRs, and the pipeline wiring intact. Not trapped in a platform shell.",
  },
  {
    title: "Optional deploy validation",
    body: "Repo handoff is the default finish line. Add Vercel credentials when you want validated deploy proof on the same run.",
  },
];

export function WhatYouGet() {
  return (
    <section className={styles.section}>
      <span className={styles.label}>What you get</span>
      <h2 className={styles.heading}>The demo is cinematic. The handoff is real.</h2>
      <p className={styles.subtitle}>
        The room is there to make the pipeline legible. The actual product
        outcome is a governed run that ends in repo proof, with deploy proof
        when you configure it.
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
