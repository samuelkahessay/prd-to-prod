"use client";

import type { FactoryState } from "./factory-types";
import styles from "./factory-hud.module.css";

interface FactoryHudProps {
  state: FactoryState;
}

export function FactoryHud({ state }: FactoryHudProps) {
  const elapsed = formatElapsed(state.elapsedMs);
  const activeAgents = Object.values(state.agents).filter(
    (a) => a.state === "working"
  );
  const timeSinceEvent = state.lastEventAt
    ? Math.floor((Date.now() - state.lastEventAt) / 1000)
    : 0;

  return (
    <div className={styles.hud}>
      <div className={styles.left}>
        <span className={`${styles.indicator} ${styles[state.ambient]}`} />
        <span className={styles.label}>{state.ambient}</span>
        <span className={styles.separator}>·</span>
        <span className={styles.label}>{elapsed}</span>
      </div>

      <div className={styles.center}>
        {activeAgents.length > 0 ? (
          activeAgents.map((a) => (
            <span key={a.id} className={styles.activeAgent}>
              {a.id.replace("-", " ")}
            </span>
          ))
        ) : (
          <span className={styles.idle}>
            {timeSinceEvent > 60
              ? `Waiting... (${Math.floor(timeSinceEvent / 60)}m)`
              : "Idle"}
          </span>
        )}
      </div>

      <div className={styles.right}>
        {state.output.issueCount > 0 && (
          <span className={styles.stat}>
            {state.output.issueCount} issue{state.output.issueCount !== 1 ? "s" : ""}
          </span>
        )}
        {state.output.prCount > 0 && (
          <span className={styles.stat}>
            {state.output.prCount} PR{state.output.prCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>
    </div>
  );
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
