"use client";

import { useEffect, useState } from "react";
import { PrdToProdAnimation } from "@/components/shared/prd-to-prod-animation";
import styles from "./splash-intro.module.css";

const CYCLE_MS = 1950; // ~54% of 3.6s cycle — right when "prod" settles
const FADE_MS = 200;
const SESSION_KEY = "prd-splash-seen";

export function SplashIntro() {
  const [phase, setPhase] = useState<"playing" | "fading" | "done">(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem(SESSION_KEY)) {
      return "done";
    }
    return "playing";
  });

  useEffect(() => {
    if (phase === "done") return;

    const fadeTimer = setTimeout(() => setPhase("fading"), CYCLE_MS);
    const doneTimer = setTimeout(() => {
      setPhase("done");
      sessionStorage.setItem(SESSION_KEY, "1");
    }, CYCLE_MS + FADE_MS);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [phase]);

  if (phase === "done") return null;

  return (
    <div
      className={`${styles.overlay} ${phase === "fading" ? styles.fading : ""}`}
      aria-hidden="true"
    >
      <PrdToProdAnimation size={80} amplitude="full" />
    </div>
  );
}
