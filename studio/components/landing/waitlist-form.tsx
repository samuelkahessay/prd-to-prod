"use client";

import { useState } from "react";
import styles from "./waitlist-form.module.css";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [github, setGithub] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg("");

    try {
      const res = await fetch("/pub/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          github_username: github.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Something went wrong");
      }

      setStatus("success");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <p className={styles.success}>
        You&apos;re on the list. We&apos;ll reach out when the private beta opens.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.field}>
        <label htmlFor="waitlist-email" className={styles.label}>
          Email
        </label>
        <input
          id="waitlist-email"
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={styles.input}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="waitlist-github" className={styles.label}>
          GitHub username (optional)
        </label>
        <input
          id="waitlist-github"
          type="text"
          placeholder="@username"
          value={github}
          onChange={(e) => setGithub(e.target.value)}
          className={styles.input}
        />
      </div>
      <button
        type="submit"
        disabled={status === "submitting"}
        className={styles.submit}
      >
        {status === "submitting" ? "Joining..." : "Join the waitlist"}
      </button>
      {status === "error" && <p className={styles.error}>{errorMsg}</p>}
    </form>
  );
}
