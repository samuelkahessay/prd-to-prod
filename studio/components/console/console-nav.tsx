"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./console-nav.module.css";

interface ConsoleNavProps {
  queueCount: number;
  pipelineHealthy: boolean;
}

export function ConsoleNav({ queueCount, pipelineHealthy }: ConsoleNavProps) {
  const pathname = usePathname();

  const tabs = [
    { label: "Launch", href: "/console#launch" },
    { label: "Runs", href: "/console/runs" },
    { label: "Queue", href: "/console#queue", badge: queueCount },
  ];

  return (
    <nav className={styles.nav}>
      <span className={styles.logo}>
        <strong>prd-to-prod</strong> / console
      </span>
      <div className={styles.tabs}>
        {tabs.map((tab) => {
          const tabPath = tab.href.split("#")[0];
          const isActive = pathname === tabPath || pathname.startsWith(tabPath + "/");
          return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`${styles.tab} ${
              isActive ? styles.active : ""
            }`}
          >
            {tab.label}
            {tab.badge ? (
              <span className={styles.badge}>{tab.badge}</span>
            ) : null}
          </Link>
          );
        })}
      </div>
      <div className={styles.spacer} />
      <div
        className={`${styles.statusDot} ${
          pipelineHealthy ? styles.ok : styles.warn
        }`}
      />
      <span className={styles.statusText}>
        {pipelineHealthy ? "pipeline healthy" : "pipeline degraded"}
      </span>
    </nav>
  );
}
