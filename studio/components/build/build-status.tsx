"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { buildApi } from "@/lib/build-api";
import { FactoryScene } from "@/components/factory/factory-scene";
import type {
  BuildEvent,
  BuildSession,
  BuildSessionStatus,
} from "@/lib/types";
import styles from "../../app/build/[id]/page.module.css";

interface BuildStatusProps {
  initialSession: BuildSession;
  initialEvents: BuildEvent[];
}

type PendingAction = "provision" | "start_build" | null;

export function BuildStatus({
  initialSession,
  initialEvents,
}: BuildStatusProps) {
  const [session, setSession] = useState(initialSession);
  const [events, setEvents] = useState(initialEvents);
  const [installUrl, setInstallUrl] = useState(() =>
    readLatestInstallUrl(initialEvents)
  );
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const autoProvisionedRef = useRef(false);
  const autoBuildStartedRef = useRef(false);

  useEffect(() => {
    return buildApi.streamBuildEvents(session.id, (event) => {
      setEvents((previous) => appendUniqueEvent(previous, event));
      setSession((previous) => applyEventToSession(previous, event));

      if (event.kind === "app_install_required") {
        setInstallUrl(readInstallUrl(event.data));
      }

      if (
        event.kind === "app_installed" ||
        event.kind === "agent_started" ||
        event.kind === "agent_progress" ||
        event.kind === "complete"
      ) {
        setInstallUrl(null);
      }
    });
  }, [session.id]);

  const provisionRepo = useCallback(async () => {
    setPendingAction("provision");
    setError(null);

    try {
      const result = await buildApi.provisionRepo(session.id);
      setSession((previous) => ({
        ...previous,
        status: parseBuildStatus(result.status),
      }));
      setInstallUrl(result.installRequired ? result.installUrl || null : null);
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Failed to provision repo"
      );
    } finally {
      setPendingAction(null);
    }
  }, [session.id]);

  const startBuild = useCallback(async () => {
    setPendingAction("start_build");
    setError(null);

    try {
      const result = await buildApi.startBuild(session.id);
      setSession((previous) => ({
        ...previous,
        status: parseBuildStatus(result.status),
      }));
      setInstallUrl(null);
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Failed to start build"
      );
    } finally {
      setPendingAction(null);
    }
  }, [session.id]);

  useEffect(() => {
    if (
      session.status !== "ready" ||
      autoProvisionedRef.current ||
      pendingAction !== null
    ) {
      return;
    }

    autoProvisionedRef.current = true;
    void provisionRepo();
  }, [pendingAction, provisionRepo, session.status]);

  useEffect(() => {
    if (
      session.status !== "provisioning" ||
      autoBuildStartedRef.current ||
      pendingAction !== null
    ) {
      return;
    }

    autoBuildStartedRef.current = true;
    void startBuild();
  }, [pendingAction, session.status, startBuild]);

  const activityEvents = useMemo(
    () => events.filter((event) => event.category !== "chat"),
    [events]
  );
  const conversationEvents = useMemo(
    () => events.filter((event) => event.category === "chat"),
    [events]
  );

  return (
    <div className={styles.detail}>
      <header className={styles.header}>
        <span className={styles.eyebrow}>Build session</span>
        <h1 className={styles.title}>
          {readPrdTitle(session.prd_final) || `Build ${session.id.slice(0, 8)}`}
        </h1>
        <p className={styles.meta}>
          Session {session.id} · created{" "}
          {new Date(session.created_at).toLocaleString()}
        </p>
      </header>

      <section className={styles.statusGrid}>
        <article className={styles.card}>
          <span className={styles.label}>Status</span>
          <div className={styles.value}>{session.status}</div>
        </article>
        <article className={styles.card}>
          <span className={styles.label}>Repository</span>
          <div className={styles.value}>
            {session.github_repo || "Not provisioned yet"}
          </div>
        </article>
        <article className={styles.card}>
          <span className={styles.label}>Deployment</span>
          <div className={styles.value}>
            {session.deploy_url || "No deployment URL yet"}
          </div>
        </article>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Factory floor</h2>
        <FactoryScene events={events} key={session.id} />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Next step</h2>
        <div className={styles.card}>
          <p className={styles.copy}>
            {describeSessionState(session.status, pendingAction)}
          </p>

          {error ? <p className={styles.error}>{error}</p> : null}

          <div className={styles.actions}>
            {renderActions({
              installUrl,
              pendingAction,
              session,
              onProvision: provisionRepo,
              onStartBuild: startBuild,
            })}
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Final PRD</h2>
        <div className={styles.card}>
          {session.prd_final ? (
            <pre className={styles.pre}>{session.prd_final}</pre>
          ) : (
            <p className={styles.empty}>No finalized PRD has been stored yet.</p>
          )}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Build activity</h2>
        <div className={styles.card}>
          {activityEvents.length > 0 ? (
            <div className={styles.timeline}>
              {activityEvents.map((event) => (
                <article className={styles.event} key={event.id}>
                  <div className={styles.role}>{formatEventLabel(event)}</div>
                  <div className={styles.eventMeta}>
                    {new Date(event.created_at).toLocaleString()}
                  </div>
                  <div className={styles.content}>
                    {formatEventDetail(event)}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className={styles.empty}>No build activity yet.</p>
          )}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Conversation</h2>
        <div className={styles.card}>
          {conversationEvents.length > 0 ? (
            <div className={styles.timeline}>
              {conversationEvents.map((event) => (
                <article className={styles.event} key={event.id}>
                  <div className={styles.role}>
                    {formatRole(event.data.role)}
                  </div>
                  <div className={styles.content}>
                    {formatMessage(event.data)}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className={styles.empty}>No conversation history available.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function renderActions({
  installUrl,
  pendingAction,
  session,
  onProvision,
  onStartBuild,
}: {
  installUrl: string | null;
  pendingAction: PendingAction;
  session: BuildSession;
  onProvision: () => void;
  onStartBuild: () => void;
}) {
  if (session.status === "ready") {
    return (
      <button
        className={styles.button}
        disabled={pendingAction !== null}
        onClick={onProvision}
        type="button"
      >
        {pendingAction === "provision" ? "Provisioning..." : "Retry provisioning"}
      </button>
    );
  }

  if (session.status === "awaiting_install") {
    return (
      <>
        {installUrl ? (
          <a
            className={styles.linkButton}
            href={installUrl}
            rel="noreferrer"
            target="_blank"
          >
            Install GitHub App
          </a>
        ) : null}
        <button
          className={styles.button}
          disabled={pendingAction !== null}
          onClick={onStartBuild}
          type="button"
        >
          {pendingAction === "start_build"
            ? "Starting build..."
            : "I've installed it - continue"}
        </button>
      </>
    );
  }

  if (session.status === "provisioning") {
    return (
      <button
        className={styles.button}
        disabled={pendingAction !== null}
        onClick={onStartBuild}
        type="button"
      >
        {pendingAction === "start_build" ? "Starting build..." : "Retry build start"}
      </button>
    );
  }

  if (session.status === "complete" && session.deploy_url) {
    return (
      <a
        className={styles.linkButton}
        href={session.deploy_url}
        rel="noreferrer"
        target="_blank"
      >
        Open deployed app
      </a>
    );
  }

  return null;
}

function appendUniqueEvent(events: BuildEvent[], nextEvent: BuildEvent): BuildEvent[] {
  if (events.some((event) => event.id === nextEvent.id)) {
    return events;
  }

  return [...events, nextEvent];
}

function applyEventToSession(
  session: BuildSession,
  event: BuildEvent
): BuildSession {
  if (event.category === "provision" && event.kind === "repo_created") {
    return {
      ...session,
      github_repo:
        typeof event.data.repo === "string" ? event.data.repo : session.github_repo,
      github_repo_id:
        typeof event.data.repoId === "number"
          ? event.data.repoId
          : session.github_repo_id,
      github_repo_url:
        typeof event.data.url === "string" ? event.data.url : session.github_repo_url,
    };
  }

  if (event.category === "provision" && event.kind === "app_install_required") {
    return {
      ...session,
      status: "awaiting_install",
    };
  }

  if (event.category === "provision" && event.kind === "app_installed") {
    return {
      ...session,
      status: "provisioning",
      app_installation_id:
        typeof event.data.installationId === "number"
          ? event.data.installationId
          : session.app_installation_id,
    };
  }

  if (event.category === "build" && event.kind === "agent_started") {
    return {
      ...session,
      status: "building",
    };
  }

  if (event.category === "delivery" && event.kind === "complete") {
    return {
      ...session,
      status: "complete",
      deploy_url:
        typeof event.data.deploy_url === "string"
          ? event.data.deploy_url
          : session.deploy_url,
    };
  }

  if (event.category === "build" && event.kind === "agent_error") {
    return {
      ...session,
      status: "failed",
    };
  }

  return session;
}

function parseBuildStatus(value: string): BuildSessionStatus {
  if (
    value === "refining" ||
    value === "ready" ||
    value === "awaiting_install" ||
    value === "provisioning" ||
    value === "building" ||
    value === "complete" ||
    value === "failed"
  ) {
    return value;
  }

  return "failed";
}

function describeSessionState(
  status: BuildSessionStatus,
  pendingAction: PendingAction
): string {
  if (pendingAction === "provision") {
    return "Creating the repository, setting labels, and checking app access.";
  }

  if (pendingAction === "start_build") {
    return "Dispatching the builder workflow in GitHub Actions.";
  }

  if (status === "ready") {
    return "Your PRD is finalized. The next step is provisioning a repository from the template.";
  }

  if (status === "awaiting_install") {
    return "The repository exists, but the GitHub App still needs access before the builder can run.";
  }

  if (status === "provisioning") {
    return "The repository is ready. Start the builder workflow to turn the PRD into a working app.";
  }

  if (status === "building") {
    return "The builder workflow is running. New events will appear here as the agent reports progress.";
  }

  if (status === "complete") {
    return "The build finished successfully. Use the deployment link if one was reported.";
  }

  if (status === "failed") {
    return "The build failed. Review the latest activity for details before retrying.";
  }

  return "This build session is still in progress.";
}

function readLatestInstallUrl(events: BuildEvent[]): string | null {
  const installEvent = [...events]
    .reverse()
    .find((event) => event.kind === "app_install_required");

  return installEvent ? readInstallUrl(installEvent.data) : null;
}

function readInstallUrl(data: Record<string, unknown>): string | null {
  return typeof data.installUrl === "string" ? data.installUrl : null;
}

function readPrdTitle(prdFinal: string | null): string | null {
  if (!prdFinal) {
    return null;
  }

  const firstLine = prdFinal.split("\n")[0]?.trim();
  if (!firstLine?.startsWith("# PRD: ")) {
    return null;
  }

  return firstLine.slice("# PRD: ".length).trim();
}

function formatEventLabel(event: BuildEvent): string {
  return `${event.category} · ${event.kind.replace(/_/g, " ")}`;
}

function formatEventDetail(event: BuildEvent): string {
  if (typeof event.data.detail === "string" && event.data.detail.length > 0) {
    return event.data.detail;
  }

  if (typeof event.data.url === "string") {
    return event.data.url;
  }

  if (typeof event.data.issueUrl === "string") {
    return event.data.issueUrl;
  }

  if (typeof event.data.deploy_url === "string") {
    return event.data.deploy_url;
  }

  return JSON.stringify(event.data);
}

function formatRole(role: unknown): string {
  if (role === "user") return "You";
  if (role === "assistant") return "prd-to-prod";
  if (role === "system") return "System";
  return "Event";
}

function formatMessage(data: Record<string, unknown>): string {
  const parsed = data.parsed;
  if (hasParsedMessage(parsed)) {
    return parsed.message;
  }

  return typeof data.content === "string" ? data.content : "";
}

function hasParsedMessage(value: unknown): value is { message: string } {
  return Boolean(
    value &&
      typeof value === "object" &&
      "message" in value &&
      typeof value.message === "string"
  );
}
