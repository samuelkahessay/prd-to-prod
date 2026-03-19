import styles from "./credibility.module.css";

const FACTS = [
  {
    stat: "31 findings filed",
    detail: "upstream to GitHub Agentic Workflows",
  },
  {
    stat: "17 fixes shipped",
    detail: "across 7 releases (v0.51.3, v0.51.6, and others)",
  },
  {
    stat: "Sub-12-minute runs",
    detail: "issue to PR to merge to deploy",
  },
  {
    stat: "Cited by gh-aw creator",
    detail: "Peli de Halleux reposted the \"New OSS\" essay",
  },
];

export function Credibility() {
  return (
    <section className={styles.section}>
      <span className={styles.label}>Track record</span>
      <div className={styles.grid}>
        {FACTS.map((f) => (
          <div key={f.stat} className={styles.item}>
            <p className={styles.stat}>{f.stat}</p>
            <p className={styles.detail}>{f.detail}</p>
          </div>
        ))}
      </div>
      <p className={styles.essay}>
        Read{" "}
        <a
          href="https://skahessay.dev"
          target="_blank"
          rel="noopener"
          className={styles.link}
        >
          &quot;The New OSS&quot;
        </a>{" "}
        for the full technical story.
      </p>
    </section>
  );
}
