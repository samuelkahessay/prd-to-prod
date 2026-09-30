import { SHOWCASE_APPS, formatShowcaseMonth } from "@/lib/showcase-data";
import styles from "./showcase-strip.module.css";

function runLabel(n: number): string {
  return `Run ${String(n).padStart(2, "0")}`;
}

export function ShowcaseStrip() {
  return (
    <section className={styles.section}>
      <span className={styles.label}>Showcase</span>
      <h2 className={styles.heading}>Built by the pipeline</h2>
      <p className={styles.subtitle}>
        5 apps. 5 PRDs. Each one autonomously decomposed, implemented, reviewed, and merged.
      </p>

      <div className={styles.strip}>
        {SHOWCASE_APPS.map((app) => (
          <div key={app.slug} className={styles.card}>
            <div className={styles.cardTop}>
              <span className={styles.runLabel}>{runLabel(app.run)}</span>
              {app.originalStack ? (
                <span className={styles.techBadge}>{app.originalStack} → Next.js</span>
              ) : (
                <span className={styles.techBadge}>{app.techStack}</span>
              )}
            </div>

            <h3 className={styles.appName}>{app.name}</h3>
            <p className={styles.appDesc}>{app.description}</p>

            <div className={styles.stats}>
              <span className={styles.stat}>
                <span className={styles.statValue}>{app.issueCount}</span>
                <span className={styles.statKey}>issues</span>
              </span>
              <span className={styles.stat}>
                <span className={styles.statValue}>{app.prCount}</span>
                <span className={styles.statKey}>PRs</span>
              </span>
              {app.testsWritten != null && (
                <span className={styles.stat}>
                  <span className={styles.statValue}>{app.testsWritten}</span>
                  <span className={styles.statKey}>tests</span>
                </span>
              )}
              {app.themes != null && (
                <span className={styles.stat}>
                  <span className={styles.statValue}>{app.themes}</span>
                  <span className={styles.statKey}>themes</span>
                </span>
              )}
              {app.linesAdded != null && app.testsWritten == null && app.themes == null && (
                <span className={styles.stat}>
                  <span className={styles.statValue}>{app.linesAdded.toLocaleString()}</span>
                  <span className={styles.statKey}>lines</span>
                </span>
              )}
            </div>

            <div className={styles.cardFooter}>
              <span className={styles.date}>{formatShowcaseMonth(app.date)}</span>
              <a href={`/showcase/${app.slug}`} className={styles.openLink}>
                Open showcase →
              </a>
            </div>
          </div>
        ))}

        {/* CTA card */}
        <div className={`${styles.card} ${styles.ctaCard}`}>
          <h3 className={styles.ctaHeading}>Run it yourself</h3>
          <p className={styles.ctaDesc}>
            The hosted beta is retired. The pipeline is open source: fork it
            and bring your own tokens.
          </p>
          <a
            href="https://github.com/samuelkahessay/prd-to-prod"
            target="_blank"
            rel="noopener"
            className={styles.ctaLink}
          >
            View the source →
          </a>
        </div>
      </div>

      <a href="/showcase" className={styles.seeAll}>
        See all →
      </a>
    </section>
  );
}
