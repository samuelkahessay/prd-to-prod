import { api } from "@/lib/api";
import { StageTrack } from "@/components/console/stage-track";
import { DecisionTrail } from "@/components/console/decision-trail";
import { ArtifactsList } from "@/components/console/artifacts-list";
import { cookies } from "next/headers";
import styles from "./page.module.css";

export default async function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieHeader = (await cookies()).toString();
  const [run, decisions] = await Promise.all([
    api.getRun(id, { cookieHeader }),
    api.getDecisions(id, { cookieHeader }),
  ]);
  if (!run) return <p>Run not found.</p>;
  const modeLabel = run.mode === "greenfield" ? "new" : run.mode;
  return (
    <div className={styles.detail}>
      <div className={styles.header}>
        <h2>Run #{run.id.slice(0, 4)} — {run.summary}</h2>
        <span className={styles.meta}>{run.status} · {modeLabel} · started {new Date(run.createdAt).toLocaleString()}</span>
      </div>
      <StageTrack events={run.events || []} />
      <h3 className={styles.sectionLabel}>Decision trail</h3>
      <DecisionTrail entries={decisions} />
      <h3 className={styles.sectionLabel}>Artifacts</h3>
      <ArtifactsList run={run} />
    </div>
  );
}
