import fs from "node:fs";
import path from "node:path";
import Image from "next/image";
import { SHOWCASE_APPS } from "@/lib/showcase-data";
import styles from "./page.module.css";

// Derive a unique gradient per app from its run number
const GRADIENTS = [
  "linear-gradient(135deg, oklch(76% 0.12 255) 0%, oklch(60% 0.18 280) 100%)", // Run 01 — blue-violet
  "linear-gradient(135deg, oklch(74% 0.13 175) 0%, oklch(58% 0.16 200) 100%)", // Run 02 — teal-green
  "linear-gradient(135deg, oklch(78% 0.14 55) 0%, oklch(62% 0.18 30) 100%)",   // Run 03 — amber-orange
  "linear-gradient(135deg, oklch(70% 0.14 300) 0%, oklch(54% 0.20 320) 100%)", // Run 04 — purple-pink
  "linear-gradient(135deg, oklch(72% 0.10 155) 0%, oklch(56% 0.15 140) 100%)", // Run 05 — green
];

function runLabel(n: number): string {
  return `Run ${String(n).padStart(2, "0")}`;
}

function previewPath(slug: string): string {
  return `/showcase/${slug}.png`;
}

function hasPreview(slug: string): boolean {
  return fs.existsSync(path.join(process.cwd(), "public", "showcase", `${slug}.png`));
}

export default function ShowcasePage() {
  return (
    <div className={styles.shell}>
      <main className={styles.page}>
        {/* Header */}
        <div className={styles.header}>
          <a href="/" className={styles.backLink}>← Home</a>
          <span className={styles.label}>Showcase</span>
          <h1 className={styles.heading}>Built by the pipeline</h1>
          <p className={styles.subtitle}>
            Five products, five PRDs. Each one autonomously decomposed, implemented,
            reviewed, and merged by the pipeline, then presented here with human polish.
          </p>
        </div>

        {/* Gallery grid */}
        <div className={styles.grid}>
          {SHOWCASE_APPS.map((app, i) => {
            const previewExists = hasPreview(app.slug);

            return (
              <div key={app.slug} className={styles.card}>
                {/* Preview */}
                <div className={styles.preview}>
                  {previewExists ? (
                    <Image
                      src={previewPath(app.slug)}
                      alt={`${app.name} landing state preview`}
                      fill
                      className={styles.previewImage}
                      sizes="(max-width: 768px) 100vw, 50vw"
                    />
                  ) : (
                    <div
                      className={styles.previewFallback}
                      style={{ background: GRADIENTS[i % GRADIENTS.length] }}
                      aria-hidden
                    />
                  )}
                </div>

                <div className={styles.cardBody}>
                  {/* Run + tech stack */}
                  <div className={styles.cardMeta}>
                    <span className={styles.runLabel}>{runLabel(app.run)}</span>
                    {app.originalStack != null ? (
                      <span className={styles.techBadge}>
                        Originally {app.originalStack}
                      </span>
                    ) : (
                      <span className={styles.techBadge}>{app.techStack}</span>
                    )}
                  </div>

                  {/* Name + description */}
                  <h2 className={styles.appName}>{app.name}</h2>
                  <p className={styles.appDesc}>{app.description}</p>

                  {/* Pipeline stats */}
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

                  {/* Actions */}
                  <div className={styles.actions}>
                    <a href={`/showcase/${app.slug}`} className={styles.actionPrimary}>
                      Open app →
                    </a>
                    <a
                      href={app.prdUrl}
                      className={styles.actionSecondary}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View PRD
                    </a>
                  </div>
                </div>
              </div>
            );
          })}

          {/* CTA card */}
          <div className={`${styles.card} ${styles.ctaCard}`}>
            <div className={styles.ctaInner}>
              <h2 className={styles.ctaHeading}>Your PRD could be next</h2>
              <p className={styles.ctaDesc}>
                Send a product spec. Get back a real repo handoff, optional
                deploy validation, and a complete audit trail.
              </p>
              <a href="/build" className={styles.ctaLink}>
                Start a build →
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
