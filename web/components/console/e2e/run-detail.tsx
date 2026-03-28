"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { E2ERun } from "@/lib/types";
import styles from "./e2e.module.css";

const LADDER = ["provision-only", "decomposer-only", "first-pr", "browser-canary"];
const STATUS_CLASS: Record<string, string> = {
  queued: styles.queued,
  auth_required: styles.auth_required,
  running: styles.running,
  passed: styles.passed,
  failed: styles.failed,
  cleaned_up: styles.cleaned_up,
  cancelled: styles.cancelled,
};

export function E2ERunDetail({
  initialRun,
  initialReportMarkdown,
}: {
  initialRun: E2ERun;
  initialReportMarkdown: string;
}) {
  const [run, setRun] = useState(initialRun);
  const [reportMarkdown, setReportMarkdown] = useState(initialReportMarkdown);
  const [cleanupPending, setCleanupPending] = useState(false);

  useEffect(() => {
    return api.streamE2ERun(run.id, (payload) => {
      const nextRun = (payload as { run?: E2ERun }).run;
      if (nextRun) {
        setRun(nextRun);
      }
    });
  }, [run.id]);

  useEffect(() => {
    if (!run.reportMarkdownPath) {
      return;
    }
    api.getE2EReport(run.id).then((result) => {
      if (result.reportMarkdown) {
        setReportMarkdown(result.reportMarkdown);
      }
    }).catch(() => {});
  }, [run.id, run.reportMarkdownPath]);

  const laneTrack = useMemo(() => {
    const current = run.activeLane || run.lane;
    const activeLanes = run.lane === "full-ladder" ? LADDER : [run.lane];
    return activeLanes.map((lane) => {
      const events = run.events?.filter((event) => event.lane === lane) || [];
      const hasFailure = events.some((event) => event.status === "failed");
      const hasPass = events.some((event) => event.status === "passed");
      const state =
        lane === current && run.status === "running"
          ? "running"
          : hasFailure
            ? "failed"
            : hasPass
              ? "passed"
              : "queued";
      return { lane, state };
    });
  }, [run]);

  async function cleanup() {
    setCleanupPending(true);
    try {
      const result = await api.cleanupE2ERun(run.id, true);
      setRun(result.run);
    } finally {
      setCleanupPending(false);
    }
  }

  return (
    <div className={styles.page}>
      <section className={styles.card}>
        <div className={styles.actions}>
          <div>
            <h1 className={styles.panelTitle}>E2E run {run.id.slice(0, 8)}</h1>
            <p className={styles.helper}>
              {run.lane} · {run.status}
              {run.failureClass ? ` · ${run.failureClass}` : ""}
            </p>
          </div>
          <button className={styles.secondaryButton} disabled={cleanupPending} onClick={cleanup}>
            {cleanupPending ? "Cleaning..." : "Cleanup repo"}
          </button>
        </div>

        <div className={styles.metaGrid}>
          <div>
            <p className={styles.metaLabel}>Repo</p>
            <p className={styles.metaValue}>
              {run.repoUrl ? (
                <a className={styles.artifactLink} href={run.repoUrl} target="_blank" rel="noreferrer">
                  {run.repoFullName}
                </a>
              ) : (
                run.repoFullName || "n/a"
              )}
            </p>
          </div>
          <div>
            <p className={styles.metaLabel}>Build session</p>
            <p className={styles.metaValue}>{run.buildSessionId || "n/a"}</p>
          </div>
          <div>
            <p className={styles.metaLabel}>Root issue</p>
            <p className={styles.metaValue}>{run.rootIssueNumber || "n/a"}</p>
          </div>
          <div>
            <p className={styles.metaLabel}>First PR</p>
            <p className={styles.metaValue}>{run.firstPrNumber || "n/a"}</p>
          </div>
          <div>
            <p className={styles.metaLabel}>Cleanup</p>
            <p className={styles.metaValue}>{run.cleanupStatus}{run.cleanupDetail ? ` · ${run.cleanupDetail}` : ""}</p>
          </div>
          <div>
            <p className={styles.metaLabel}>Started</p>
            <p className={styles.metaValue}>{new Date(run.createdAt).toLocaleString()}</p>
          </div>
        </div>
      </section>

      <section className={styles.card}>
        <h2 className={styles.sectionTitle}>Ladder</h2>
        <div className={styles.laneTrack}>
          {laneTrack.map((entry) => (
            <div key={entry.lane} className={styles.lanePill}>
              <span>{entry.lane}</span>
              <span className={`${styles.status} ${STATUS_CLASS[entry.state] || ""}`}>{entry.state}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.card}>
        <h2 className={styles.sectionTitle}>Timeline</h2>
        <div className={styles.timeline}>
          {(run.events || []).map((event) => (
            <div key={event.id} className={styles.timelineItem}>
              <p className={styles.timelineMeta}>
                {new Date(event.createdAt).toLocaleString()} · {event.lane || run.lane} · {event.step}
              </p>
              <div className={styles.actions}>
                <span className={`${styles.status} ${STATUS_CLASS[event.status] || ""}`}>{event.status}</span>
                <span>{event.detail || "No detail."}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.card}>
        <h2 className={styles.sectionTitle}>Artifacts</h2>
        <div className={styles.artifactList}>
          {run.artifactRefs.map((artifact, index) =>
            artifact.url ? (
              <a
                key={`${artifact.type}-${index}`}
                className={styles.artifactLink}
                href={artifact.url}
                rel="noreferrer"
                target="_blank"
              >
                {artifact.label || artifact.type}
              </a>
            ) : artifact.path ? (
              <Link
                key={`${artifact.type}-${index}`}
                className={styles.artifactLink}
                href={`/console/e2e/${run.id}`}
              >
                {artifact.type}: {artifact.path}
              </Link>
            ) : null
          )}
          {run.artifactRefs.length === 0 ? <div className={styles.empty}>No artifacts recorded yet.</div> : null}
        </div>
      </section>

      <section className={styles.card}>
        <h2 className={styles.sectionTitle}>Report</h2>
        <div className={styles.report}>{reportMarkdown || "Report not written yet."}</div>
      </section>
    </div>
  );
}
