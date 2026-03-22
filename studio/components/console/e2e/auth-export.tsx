"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { buildApi } from "@/lib/build-api";
import styles from "./e2e.module.css";

export function E2EAuthExport() {
  const searchParams = useSearchParams();
  const cookieJarPath = searchParams.get("jar") || "";
  const exportRequestId = searchParams.get("export") || "";
  const [authState, setAuthState] = useState<"checking" | "needs_auth" | "ready" | "saved">("checking");
  const [message, setMessage] = useState("Checking build-session auth.");

  const returnTo = useMemo(() => {
    const params = new URLSearchParams();
    if (cookieJarPath) {
      params.set("jar", cookieJarPath);
    }
    if (exportRequestId) {
      params.set("export", exportRequestId);
    }
    return `/console/e2e/auth${params.toString() ? `?${params.toString()}` : ""}`;
  }, [cookieJarPath, exportRequestId]);

  useEffect(() => {
    buildApi
      .getMe({ validateProvision: true })
      .then(() => {
        setAuthState("ready");
        setMessage("Build-session auth is active. Exporting the cookie jar.");
      })
      .catch(() => {
        setAuthState("needs_auth");
        setMessage("Sign in with GitHub first, then return here to export the cookie jar.");
      });
  }, []);

  useEffect(() => {
    if (authState !== "ready") {
      return;
    }

    api
      .exportE2EAuthCookie(cookieJarPath, exportRequestId)
      .then((result) => {
        setAuthState("saved");
        if (result.mode === "handoff") {
          setMessage("Browser auth is ready. The local CLI can now save the cookie jar.");
        } else {
          setMessage(`Saved the browser auth cookie to ${result.cookieJarPath}.`);
        }
      })
      .catch((error) => {
        setMessage(error instanceof Error ? error.message : "Failed to export the cookie jar.");
      });
  }, [authState, cookieJarPath, exportRequestId]);

  return (
    <div className={styles.page}>
      <section className={styles.panel}>
        <h1 className={styles.panelTitle}>E2E auth bootstrap</h1>
        <p className={styles.helper}>{message}</p>
        <div className={styles.actions}>
          {authState === "needs_auth" ? (
            <Link
              className={styles.button}
              href={`/pub/auth/github?return_to=${encodeURIComponent(returnTo)}`}
            >
              Sign in with GitHub
            </Link>
          ) : null}
          <Link className={styles.secondaryButton} href="/console/e2e">
            Back to E2E dashboard
          </Link>
        </div>
      </section>
    </div>
  );
}
