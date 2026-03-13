import { fetchEvidenceData } from "@/lib/github";
import { StickyNav } from "@/components/landing/sticky-nav";
import { Hero } from "@/components/landing/hero";
import { Pricing } from "@/components/landing/pricing";
import { WhatYouGet } from "@/components/landing/what-you-get";
import { HowItWorks } from "@/components/landing/how-it-works";
import { EvidenceLedger } from "@/components/landing/evidence-ledger";
import { BottomCta } from "@/components/landing/bottom-cta";
import styles from "./page.module.css";

export default async function LandingPage() {
  const evidence = await fetchEvidenceData();

  return (
    <>
      <header>
        <StickyNav />
      </header>

      <main className={styles.page}>
        <Hero />

      <hr className={styles.divider} />
      <Pricing />

      <hr className={styles.divider} />
      <WhatYouGet />

      <hr className={styles.divider} />
      <HowItWorks />

      <hr className={styles.divider} />
      <EvidenceLedger rows={evidence} />

      <hr className={styles.divider} />
      </main>

      <BottomCta />
    </>
  );
}
