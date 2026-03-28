"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import styles from "./launch-form.module.css";

export function LaunchForm() {
  const [inputSource, setInputSource] = useState<"notes" | "workiq">("notes");
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [content, setContent] = useState("");
  const [targetRepo, setTargetRepo] = useState("");
  const [mockMode, setMockMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    setResult(null);
    try {
      const payload: Record<string, unknown> = {
        inputSource,
        mode,
        mockMode,
      };
      if (inputSource === "notes") {
        payload.notes = content;
      } else {
        payload.query = content;
      }
      if (mode === "existing") {
        payload.targetRepo = targetRepo;
      }
      const res = await api.startRun(payload as any);
      setResult(res.runId);
      setContent("");
    } catch (err) {
      setResult("Error: " + (err instanceof Error ? err.message : "Unknown"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.form}>
      <h3 className={styles.heading}>Launch a run</h3>

      <div className={styles.toggleRow}>
        <button
          className={`${styles.toggle} ${inputSource === "notes" ? styles.toggleActive : ""}`}
          onClick={() => setInputSource("notes")}
        >
          Raw notes
        </button>
        <button
          className={`${styles.toggle} ${inputSource === "workiq" ? styles.toggleActive : ""}`}
          onClick={() => setInputSource("workiq")}
        >
          WorkIQ query
        </button>
      </div>

      <textarea
        className={styles.textarea}
        placeholder={inputSource === "notes" ? "Paste meeting notes, PRD, or description..." : "Enter WorkIQ query..."}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={6}
      />

      <div className={styles.toggleRow}>
        <button
          className={`${styles.toggle} ${mode === "new" ? styles.toggleActive : ""}`}
          onClick={() => setMode("new")}
        >
          New product
        </button>
        <button
          className={`${styles.toggle} ${mode === "existing" ? styles.toggleActive : ""}`}
          onClick={() => setMode("existing")}
        >
          Existing product
        </button>
      </div>

      {mode === "existing" && (
        <input
          className={styles.input}
          type="text"
          placeholder="owner/repo"
          value={targetRepo}
          onChange={(e) => setTargetRepo(e.target.value)}
        />
      )}

      <label className={styles.checkbox}>
        <input type="checkbox" checked={mockMode} onChange={(e) => setMockMode(e.target.checked)} />
        Mock mode
      </label>

      <button
        className={styles.submit}
        onClick={handleSubmit}
        disabled={submitting || !content.trim()}
      >
        {submitting ? "Starting..." : "Start run"}
      </button>

      {result && (
        <div className={styles.result}>
          {result.startsWith("Error") ? result : (
            <>Run started: <a href={`/console/runs/${result}`}>{result.slice(0, 8)}...</a></>
          )}
        </div>
      )}
    </div>
  );
}
