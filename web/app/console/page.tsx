"use client";

import { useEffect, useState } from "react";
import { LaunchForm } from "@/components/console/launch-form";
import { PreflightPanel } from "@/components/console/preflight-panel";
import { QueuePanel } from "@/components/console/queue-panel";
import { RunsTable } from "@/components/console/runs-table";
import { api } from "@/lib/api";
import type { PreflightCheck, QueueItem, Run } from "@/lib/types";
import styles from "./page.module.css";

export default function ConsolePage() {
  const [checks, setChecks] = useState<PreflightCheck[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);

  useEffect(() => {
    api.preflight().then(setChecks).catch(console.error);
    api.getQueue().then(setQueue).catch(console.error);
    api.listRuns().then(setRuns).catch(console.error);
  }, []);

  return (
    <div className={styles.consolePage}>
      <section id="launch" className={styles.launchPanel}>
        <LaunchForm />
        <PreflightPanel checks={checks} />
      </section>

      <section id="queue">
        {queue.length > 0 && (
          <QueuePanel items={queue} onResolve={(id, resolution) => {
            api.resolveQueueItem(id, resolution).then(() => {
              api.getQueue().then(setQueue);
            });
          }} />
        )}
      </section>

      <RunsTable runs={runs} />
    </div>
  );
}
