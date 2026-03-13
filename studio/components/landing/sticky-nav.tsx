"use client";

import { useEffect, useState } from "react";
import styles from "./sticky-nav.module.css";

const MAILTO = "mailto:kahessay@icloud.com?subject=PRD%20Submission";

export function StickyNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 80);
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={`${styles.nav} ${scrolled ? styles.scrolled : ""}`}>
      <a href="/" className={styles.logo}>prd-to-prod</a>
      <div className={styles.links}>
        <a href="#pricing" className={styles.link}>Pricing</a>
        <a href="#how-it-works" className={styles.link}>How it works</a>
        <a href="#for-teams" className={styles.link}>For Teams</a>
        <a
          href="https://github.com/samuelkahessay/prd-to-prod"
          className={styles.link}
          target="_blank"
          rel="noopener"
        >
          GitHub
        </a>
        <a href={MAILTO} className={styles.cta}>Send your PRD →</a>
      </div>
    </nav>
  );
}
