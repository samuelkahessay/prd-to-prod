import { fetchEvidenceData } from "@/lib/github";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { ContrastList } from "@/components/landing/contrast-list";
import { EvidenceLedger } from "@/components/landing/evidence-ledger";
import { BottomCta } from "@/components/landing/bottom-cta";
import styles from "./page.module.css";

export default async function LandingPage() {
  const evidence = await fetchEvidenceData();

  return (
    <main className={styles.page}>
      <nav className={styles.nav}>
        <span className={styles.logo}>prd-to-prod</span>
        <div className={styles.links}>
          <a href="/console">Console</a>
          <a href="https://github.com/samuelkahessay/prd-to-prod">GitHub</a>
        </div>
      </nav>

      <Hero />

      <hr className={styles.divider} />
      <HowItWorks />

      <hr className={styles.divider} />
      <ContrastList />

      <hr className={styles.divider} />
      <EvidenceLedger rows={evidence} />

      <hr className={styles.divider} />
      <BottomCta />
    </main>
  );
}
