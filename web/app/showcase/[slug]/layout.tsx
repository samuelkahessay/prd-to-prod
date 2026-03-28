import { notFound } from "next/navigation";
import { getShowcaseApp } from "@/lib/showcase-data";
import styles from "./layout.module.css";

export default async function ShowcaseAppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const app = getShowcaseApp(slug);

  if (!app) {
    notFound();
  }

  return (
    <div className={styles.shell}>
      {/* Mobile collapsible top bar */}
      <details className={styles.mobileBar}>
        <summary className={styles.mobileSummary}>
          <span className={styles.mobileAppName}>{app.name}</span>
          <span className={styles.techBadge}>
            {app.originalStack != null
              ? `Originally ${app.originalStack}`
              : app.techStack}
          </span>
        </summary>
        <div className={styles.mobileDetails}>
          <p className={styles.description}>{app.description}</p>
          <div className={styles.stats}>
            <div className={styles.stat}>
              <span className={styles.statValue}>{app.issueCount}</span>
              <span className={styles.statKey}>issues decomposed</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>{app.prCount}</span>
              <span className={styles.statKey}>PRs merged</span>
            </div>
            {app.testsWritten != null && (
              <div className={styles.stat}>
                <span className={styles.statValue}>{app.testsWritten}</span>
                <span className={styles.statKey}>tests written</span>
              </div>
            )}
            {app.themes != null && (
              <div className={styles.stat}>
                <span className={styles.statValue}>{app.themes}</span>
                <span className={styles.statKey}>themes</span>
              </div>
            )}
            {app.linesAdded != null && (
              <div className={styles.stat}>
                <span className={styles.statValue}>{app.linesAdded.toLocaleString()}</span>
                <span className={styles.statKey}>lines added</span>
              </div>
            )}
            {app.filesChanged != null && (
              <div className={styles.stat}>
                <span className={styles.statValue}>{app.filesChanged}</span>
                <span className={styles.statKey}>files changed</span>
              </div>
            )}
          </div>
          <a
            href={app.prdUrl}
            className={styles.prdLink}
            target="_blank"
            rel="noopener noreferrer"
          >
            View PRD →
          </a>
        </div>
      </details>

      {/* Sidebar (desktop) */}
      <aside className={styles.sidebar}>
        <a href="/showcase" className={styles.backLink}>
          ← Back to showcase
        </a>

        <h1 className={styles.appName}>{app.name}</h1>

        <span className={styles.techBadge}>
          {app.originalStack != null
            ? `Originally ${app.originalStack}`
            : app.techStack}
        </span>

        <p className={styles.description}>{app.description}</p>

        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statValue}>{app.issueCount}</span>
            <span className={styles.statKey}>issues decomposed</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{app.prCount}</span>
            <span className={styles.statKey}>PRs merged</span>
          </div>
          {app.testsWritten != null && (
            <div className={styles.stat}>
              <span className={styles.statValue}>{app.testsWritten}</span>
              <span className={styles.statKey}>tests written</span>
            </div>
          )}
          {app.themes != null && (
            <div className={styles.stat}>
              <span className={styles.statValue}>{app.themes}</span>
              <span className={styles.statKey}>themes</span>
            </div>
          )}
          {app.linesAdded != null && (
            <div className={styles.stat}>
              <span className={styles.statValue}>{app.linesAdded.toLocaleString()}</span>
              <span className={styles.statKey}>lines added</span>
            </div>
          )}
          {app.filesChanged != null && (
            <div className={styles.stat}>
              <span className={styles.statValue}>{app.filesChanged}</span>
              <span className={styles.statKey}>files changed</span>
            </div>
          )}
        </div>

        <a
          href={app.prdUrl}
          className={styles.prdLink}
          target="_blank"
          rel="noopener noreferrer"
        >
          View PRD →
        </a>
      </aside>

      {/* Main content */}
      <main className={styles.main}>{children}</main>
    </div>
  );
}
