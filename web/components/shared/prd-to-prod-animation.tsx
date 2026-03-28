// web/components/shared/prd-to-prod-animation.tsx
"use client";

import { useMemo } from "react";
import styles from "./prd-to-prod-animation.module.css";

interface PrdToProdAnimationProps {
  /** Animation intensity — controls fall distance, squash, hop height */
  amplitude?: "tight" | "medium" | "full";
  /** Add organic tilt to ripple hops */
  rotation?: boolean;
  /** Propagate squash & stretch to all letters, not just the "o" */
  squashPropagation?: boolean;
  /** Font size in pixels */
  size?: number;
  /** Override cycle duration in seconds (min 2.5) */
  duration?: number;
}

export function PrdToProdAnimation({
  amplitude = "medium",
  rotation = false,
  squashPropagation = false,
  size = 48,
  duration = 3.6,
}: PrdToProdAnimationProps) {
  const clampedDuration = Math.max(2.5, duration);

  const cssVars = useMemo(() => {
    const vars: Record<string, string> = {
      "--duration": `${clampedDuration}s`,
      "--rotation": rotation ? "2deg" : "0deg",
      "--rotation-neg": rotation ? "-2deg" : "0deg",
    };

    if (squashPropagation) {
      vars["--ripple-squash-x"] = "1.1";
      vars["--ripple-squash-y"] = "0.88";
      vars["--ripple-squash-x-inv"] = "0.92";
      vars["--ripple-squash-y-inv"] = "1.1";
    }

    return vars;
  }, [clampedDuration, rotation, squashPropagation]);

  const amplitudeClass =
    amplitude === "tight"
      ? styles.tight
      : amplitude === "full"
        ? styles.full
        : undefined;

  return (
    <div
      className={styles.container}
      role="img"
      aria-label="prd to prod loading"
    >
      <div
        className={`${styles.letters} ${amplitudeClass ?? ""}`.trim()}
        style={{ fontSize: `${size}px`, ...cssVars } as React.CSSProperties}
      >
        <span className={`${styles.letter} ${styles.letterP}`} aria-hidden="true">p</span>
        <span className={`${styles.letter} ${styles.letterR}`} aria-hidden="true">r</span>
        <span className={`${styles.letter} ${styles.letterO}`} aria-hidden="true">o</span>
        <span className={`${styles.letter} ${styles.letterD}`} aria-hidden="true">d</span>
      </div>
    </div>
  );
}
