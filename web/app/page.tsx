import { StickyNav } from "@/components/landing/sticky-nav";
import { SplashIntro } from "@/components/landing/splash-intro";
import { Hero } from "@/components/landing/hero";
import { Pipeline } from "@/components/landing/pipeline";
import { Proof } from "@/components/landing/proof";
import { Audience } from "@/components/landing/audience";
import { BottomCta } from "@/components/landing/bottom-cta";
import styles from "./page.module.css";

export default function LandingPage() {
  return (
    <div className={styles.shell}>
      <SplashIntro />
      <header>
        <StickyNav />
      </header>

      <main className={styles.page}>
        <Hero />

        <hr className={styles.divider} />
        <Pipeline />

        <hr className={styles.divider} />
        <Proof />

        <hr className={styles.divider} />
        <Audience />

        <hr className={styles.divider} />
      </main>

      <BottomCta />
    </div>
  );
}
