import type { RunEvent, StageStatus } from "@/lib/types";
import styles from "./stage-track.module.css";

function deriveStages(events: RunEvent[]): StageStatus[] {
  const stages: StageStatus[] = [
    { name: "Extract", state: "pending", label: "" },
    { name: "Build", state: "pending", label: "" },
    { name: "Review", state: "pending", label: "" },
    { name: "Policy", state: "pending", label: "" },
    { name: "Deploy", state: "pending", label: "" },
  ];

  for (const event of events) {
    if (event.stage === "EXTRACT") {
      if (event.kind === "stage_complete") stages[0] = { ...stages[0], state: "done", label: "complete" };
      else if (event.kind === "stage_start") stages[0] = { ...stages[0], state: "active", label: "in progress" };
    }
    if (event.stage === "BUILD" || event.stage === "ANALYZE") {
      if (event.kind === "stage_complete") stages[1] = { ...stages[1], state: "done", label: "complete" };
      else if (event.kind === "stage_start") stages[1] = { ...stages[1], state: "active", label: "in progress" };
    }
    if (event.kind === "artifact" && event.data?.key === "tracking_issue_number") {
      stages[2] = { ...stages[2], state: "done", label: "PR opened" };
    }
    if (event.type === "blocked") {
      stages[3] = { ...stages[3], state: "blocked", label: (event.data?.event as string) || "policy gate" };
    }
    if (event.type === "human" && (event.kind as string) === "queue_resolved") {
      stages[3] = { ...stages[3], state: "done", label: (event.data?.resolution as string) || "resolved" };
    }
    if (event.kind === "run_complete") {
      stages[4] = { ...stages[4], state: "done", label: "deployed" };
    }
  }

  return stages;
}

export function StageTrack({ events }: { events: RunEvent[] }) {
  const stages = deriveStages(events);
  return (
    <div className={styles.track}>
      {stages.map((stage) => (
        <div key={stage.name} className={`${styles.stage} ${styles[stage.state]}`}>
          <div className={styles.name}>{stage.name}</div>
          <div className={styles.label}>{stage.label}</div>
        </div>
      ))}
    </div>
  );
}
