import styles from "./bottom-cta.module.css";
import { WaitlistForm } from "./waitlist-form";

export function BottomCta() {
  return (
    <footer className={styles.section}>
      <h2 className={styles.heading}>Start with the floor. End with repo proof.</h2>
      <p className={styles.body}>
        Watch the guided demo first, then launch your own governed run when
        you&apos;re ready to hand a real PRD to the pipeline.
      </p>
      <div className={styles.actions}>
        <a href="/demo" className={styles.ctaPrimary}>Watch demo</a>
        <a href="/build" className={styles.ctaSecondary}>Run your own PRD</a>
      </div>
      <WaitlistForm />
    </footer>
  );
}
