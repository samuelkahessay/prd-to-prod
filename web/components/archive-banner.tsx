import styles from "./archive-banner.module.css";

/**
 * Archive banner shown when the site is opened directly.
 *
 * skahessay.dev shows this site inside its own archive frame, which already
 * carries the archive notice, so the inline script hides the banner there.
 * It runs before first paint, so the framed view never flashes the banner.
 */
const HIDE_WHEN_FRAMED =
  "if(window.self!==window.top){document.getElementById('archive-banner').hidden=true}";

export function ArchiveBanner() {
  return (
    <>
      <div id="archive-banner" role="note" suppressHydrationWarning className={styles.banner}>
        <span>
          <strong>Archived 2026.</strong> The hosted beta is retired; this site
          is kept for reference.
        </span>
        <a href="https://skahessay.dev/archive#prd-to-prod">About this archive</a>
      </div>
      <script dangerouslySetInnerHTML={{ __html: HIDE_WHEN_FRAMED }} />
    </>
  );
}
