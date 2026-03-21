"use client";

import { useEffect, useState } from "react";
import styles from "./sticky-nav.module.css";


export function StickyNav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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
      <a href="/" className={styles.logo}>prd to prod</a>
      <div className={styles.right}>
        <div className={styles.links}>
          <a href="#pricing" className={styles.link}>Pricing</a>
          <a href="#how-it-works" className={styles.link}>How it works</a>
          <a
            href="https://github.com/samuelkahessay/prd-to-prod"
            className={styles.link}
            target="_blank"
            rel="noopener"
          >
            GitHub
          </a>
        </div>
        <a href="/build" className={styles.cta}>Send your PRD</a>
        <button
          className={`${styles.menuBtn} ${menuOpen ? styles.menuOpen : ""}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
        >
          <span className={styles.menuLine} />
          <span className={styles.menuLine} />
        </button>
      </div>
      {menuOpen && (
        <div className={styles.dropdown}>
          <a href="#pricing" className={styles.dropLink} onClick={() => setMenuOpen(false)}>Pricing</a>
          <a href="#how-it-works" className={styles.dropLink} onClick={() => setMenuOpen(false)}>How it works</a>
          <a
            href="https://github.com/samuelkahessay/prd-to-prod"
            className={styles.dropLink}
            target="_blank"
            rel="noopener"
            onClick={() => setMenuOpen(false)}
          >
            GitHub
          </a>
        </div>
      )}
    </nav>
  );
}
