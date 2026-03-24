"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import type { E2ERun, E2ERunLane } from "@/lib/types";
import styles from "./e2e.module.css";

const DASHBOARD_LANES: E2ERunLane[] = [
  "provision-only",
  "decomposer-only",
  "first-pr",
  "demo-browser-canary",
  "full-ladder",
];

const STATUS_CLASS: Record<string, string> = {
  queued: styles.queued,
  auth_required: styles.auth_required,
  running: styles.running,
  passed: styles.passed,
  failed: styles.failed,
  cleaned_up: styles.cleaned_up,
  cancelled: styles.cancelled,
};

export function E2EDashboard({
  initialRuns,
  defaultCookieJarPath,
}: {
  initialRuns: E2ERun[];
  defaultCookieJarPath: string;
}) {
  const [runs, setRuns] = useState(initialRuns);
  const [lane, setLane] = useState<E2ERunLane>("provision-only");
  const [keepRepo, setKeepRepo] = useState(true);
  const [cookieJarPath, setCookieJarPath] = useState(defaultCookieJarPath);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  async function startRun() {
    setSubmitting(true);
    setResult("");
    setError("");
    try {
      const response = await api.startE2ERun({
        lane,
        keepRepo,
        cookieJarPath,
      });
      const nextRuns = await api.listE2ERuns();
      setRuns(nextRuns);
      setResult(`Run ${response.run.id.slice(0, 8)} started.`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to start E2E run");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.grid}>
        <section className={styles.panel}>
          <h1 className={styles.panelTitle}>Fast E2E Harness</h1>
          <p className={styles.helper}>
            Launch the cheap lanes first, then only spend full browser time once the repo-side gates are green.
          </p>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="lane">
              Lane
            </label>
            <select
              id="lane"
              className={styles.select}
              value={lane}
              onChange={(event) => setLane(event.target.value as E2ERunLane)}
            >
              {DASHBOARD_LANES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="cookieJar">
              Cookie jar
            </label>
            <input
              id="cookieJar"
              className={styles.input}
              value={cookieJarPath}
              onChange={(event) => setCookieJarPath(event.target.value)}
            />
          </div>

          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={keepRepo}
              onChange={(event) => setKeepRepo(event.target.checked)}
            />
            Keep temp repo after the run
          </label>

          <div className={styles.actions}>
            <button className={styles.button} disabled={submitting} onClick={startRun}>
              {submitting ? "Starting..." : "Start lane"}
            </button>
            <Link
              className={styles.linkButton}
              href={`/console/e2e/auth?jar=${encodeURIComponent(cookieJarPath)}`}
            >
              Refresh auth cookie
            </Link>
          </div>

          {result ? <p className={styles.result}>{result}</p> : null}
          {error ? <p className={styles.error}>{error}</p> : null}
          <p className={styles.note}>
            `browser-canary` remains CLI-first for authenticated build flows. `demo-browser-canary` is the dashboard-safe public demo smoke.
          </p>
        </section>

        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>Recent runs</h2>
          {runs.length === 0 ? (
            <div className={styles.empty}>No E2E runs yet.</div>
          ) : (
            <div className={styles.table}>
              <div className={styles.headerRow}>
                <span>Lane</span>
                <span>Run</span>
                <span>Repo</span>
                <span>Started</span>
                <span>Status</span>
              </div>
              {runs.map((run) => (
                <Link key={run.id} href={`/console/e2e/${run.id}`} className={styles.row}>
                  <span>{run.lane}</span>
                  <span>{run.id.slice(0, 8)}</span>
                  <span>{run.repoFullName || "—"}</span>
                  <span>{new Date(run.createdAt).toLocaleString()}</span>
                  <span className={`${styles.status} ${STATUS_CLASS[run.status] || ""}`}>
                    {run.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
