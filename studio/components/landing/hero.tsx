import Image from "next/image";
import styles from "./hero.module.css";
import { WaitlistForm } from "./waitlist-form";

export function Hero() {
  return (
    <section className={styles.hero}>
      <div className={styles.copy}>
        <p className={styles.eyebrow}>Five agents. One room. One governed build.</p>
        <h1 className={styles.headline}>
          Paste a PRD.<br />
          Watch five agents build it.
        </h1>
        <p className={styles.subtitle}>
          prd-to-prod turns a product brief into a real GitHub repo through a
          governed multi-agent pipeline. The factory floor gives you the
          spectacle. The repo handoff and deploy proof close the loop.
        </p>
        <div className={styles.actions}>
          <a href="/demo" className={styles.ctaPrimary}>Watch demo</a>
          <a href="/build" className={styles.ctaSecondary}>Run your own PRD</a>
        </div>
        <WaitlistForm />
        <p className={styles.scope}>
          Web apps only. Repo handoff always. Deploy proof when configured.
        </p>
      </div>

      <div className={styles.media} aria-label="Demo stills">
        <article className={`${styles.frame} ${styles.framePrimary}`}>
          <div className={styles.frameMeta}>Factory floor</div>
          <div className={styles.frameImageWrap}>
            <Image
              src="/demo/demo-floor.png"
              alt="Factory floor replay with five animated agents at isometric workstations"
              fill
              priority
              className={styles.frameImage}
              sizes="(max-width: 900px) 100vw, 44vw"
            />
          </div>
          <p className={styles.frameCaption}>
            Agents plan, code, review, and merge — live.
          </p>
        </article>

        <article className={`${styles.frame} ${styles.frameSecondary}`}>
          <div className={styles.frameMeta}>Proof endcap</div>
          <div className={styles.frameImageWrap}>
            <Image
              src="/demo/demo-proof.png"
              alt="Proof endcap showing repository and deployment evidence after the floor completes"
              fill
              className={styles.frameImage}
              sizes="(max-width: 900px) 100vw, 28vw"
            />
          </div>
          <p className={styles.frameCaption}>
            Repo handoff and deploy evidence when the build finishes.
          </p>
        </article>
      </div>
    </section>
  );
}
