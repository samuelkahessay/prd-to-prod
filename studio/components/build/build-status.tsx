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
import { PrdToProdAnimation } from "@/components/shared/prd-to-prod-animation";
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
  const isDemo = !!initialSession.is_demo;
  const [session, setSession] = useState(initialSession);
  const [events, setEvents] = useState(initialEvents);
  const [installUrl, setInstallUrl] = useState(() =>
    readLatestInstallUrl(initialEvents)
  );
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const autoProvisionedRef = useRef(false);
  const autoBuildStartedRef = useRef(false);
  const [codeRedeemed, setCodeRedeemed] = useState(isDemo);
  const [credentialsSubmitted, setCredentialsSubmitted] = useState(isDemo);
  const [gatesHydrated, setGatesHydrated] = useState(isDemo);

  useEffect(() => {
    if (isDemo) return;
    buildApi.getSession(session.id).then((data) => {
      const gates = (data as { gates?: { codeRedeemed: boolean; credentialsSubmitted: boolean } }).gates;
      if (gates) {
        setCodeRedeemed(gates.codeRedeemed);
        setCredentialsSubmitted(gates.credentialsSubmitted);
      }
      setGatesHydrated(true);
    }).catch(() => setGatesHydrated(true));
  }, [isDemo, session.id]);

  useEffect(() => {
    return buildApi.streamBuildEvents(session.id, (event) => {
      setEvents((previous) => appendUniqueEvent(previous, event));
      setSession((previous) => applyEventToSession(previous, event));

      if (event.kind === "app_install_required") {
        setInstallUrl(readInstallUrl(event.data));
      }

      if (
        event.kind === "app_installed" ||
        event.kind === "bootstrap_started" ||
        event.kind === "bootstrap_complete" ||
        event.kind === "pipeline_started" ||
        event.kind === "agent_started" ||
        event.kind === "agent_progress" ||
        event.kind === "handoff_ready" ||
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
    } catch (nextError: unknown) {
      const apiErr = nextError as { action?: string; returnTo?: string; message?: string };
      if (apiErr.action === "re_auth") {
        const returnTo = apiErr.returnTo || `/build/${session.id}`;
        window.location.href = `/pub/auth/github?return_to=${encodeURIComponent(returnTo)}`;
        return;
      }
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
      pendingAction !== null ||
      !gatesHydrated ||
      !codeRedeemed ||
      !credentialsSubmitted
    ) {
      return;
    }

    autoProvisionedRef.current = true;
    void provisionRepo();
  }, [pendingAction, provisionRepo, session.status, gatesHydrated, codeRedeemed, credentialsSubmitted]);

  useEffect(() => {
    if (
      session.status !== "ready_to_launch" ||
      autoBuildStartedRef.current ||
      pendingAction !== null
    ) {
      return;
    }

    autoBuildStartedRef.current = true;
    void startBuild();
  }, [pendingAction, session.status, startBuild]);

  // 200ms show-delay: prevents animation flicker on fast responses (Vercel guideline)
  const [showAnimation, setShowAnimation] = useState(false);
  useEffect(() => {
    if (!pendingAction) {
      setShowAnimation(false);
      return;
    }
    const timer = setTimeout(() => setShowAnimation(true), 200);
    return () => clearTimeout(timer);
  }, [pendingAction]);

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
        {isDemo && <span className={styles.demoPill}>Demo</span>}
      </header>

      <section className={styles.statusGrid}>
        <article className={styles.card}>
          <span className={styles.label}>Status</span>
          <div className={styles.value}>{session.status}</div>
        </article>
        <article className={styles.card}>
          <span className={styles.label}>Repository</span>
          <div className={styles.value}>
            {session.github_repo
              ? isDemo
                ? <span className={styles.simulated}>{session.github_repo} (simulated)</span>
                : session.github_repo
              : "Not provisioned yet"}
          </div>
        </article>
        <article className={styles.card}>
          <span className={styles.label}>Deployment</span>
          <div className={styles.value}>
            {session.deploy_url
              ? isDemo
                ? <span className={styles.simulated}>{session.deploy_url} (simulated)</span>
                : session.deploy_url
              : "No deployment URL yet"}
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
          {pendingAction && showAnimation ? (
            <div style={{ margin: "8px 0 16px" }}>
              <PrdToProdAnimation size={28} amplitude="tight" />
            </div>
          ) : null}

          <p className={styles.copy}>
            {describeSessionState(session.status, pendingAction)}
          </p>

          {error ? <p className={styles.error}>{error}</p> : null}

          <div className={styles.actions}>
            {renderActions({
              events,
              installUrl,
              isDemo,
              pendingAction,
              session,
              onProvision: provisionRepo,
              onStartBuild: startBuild,
              codeRedeemed,
              credentialsSubmitted,
              onCodeRedeemed: () => setCodeRedeemed(true),
              onCredentialsSubmitted: () => setCredentialsSubmitted(true),
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
  events,
  installUrl,
  isDemo,
  pendingAction,
  session,
  onProvision,
  onStartBuild,
  codeRedeemed,
  credentialsSubmitted,
  onCodeRedeemed,
  onCredentialsSubmitted,
}: {
  events: BuildEvent[];
  installUrl: string | null;
  isDemo: boolean;
  pendingAction: PendingAction;
  session: BuildSession;
  onProvision: () => void;
  onStartBuild: () => void;
  codeRedeemed: boolean;
  credentialsSubmitted: boolean;
  onCodeRedeemed: () => void;
  onCredentialsSubmitted: () => void;
}) {
  if (session.status === "ready") {
    if (!isDemo && !codeRedeemed) {
      return <AccessCodeForm sessionId={session.id} onRedeemed={onCodeRedeemed} />;
    }
    if (!isDemo && !credentialsSubmitted) {
      return <ByokForm sessionId={session.id} onSubmitted={onCredentialsSubmitted} />;
    }
    return (
      <button
        className={styles.button}
        disabled={pendingAction !== null}
        onClick={onProvision}
        type="button"
      >
        {pendingAction === "provision" ? "Provisioning..." : "Provision repository"}
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
          onClick={onProvision}
          type="button"
        >
          {pendingAction === "provision"
            ? "Checking installation..."
            : "I've installed it - continue"}
        </button>
      </>
    );
  }

  if (session.status === "bootstrapping") {
    return (
      <button
        className={styles.button}
        disabled={pendingAction !== null}
        onClick={onProvision}
        type="button"
      >
        {pendingAction === "provision" ? "Bootstrapping..." : "Retry bootstrap"}
      </button>
    );
  }

  if (session.status === "ready_to_launch" || session.status === "awaiting_capacity") {
    return (
      <button
        className={styles.button}
        disabled={pendingAction !== null}
        onClick={onStartBuild}
        type="button"
      >
        {pendingAction === "start_build"
          ? "Launching pipeline..."
          : session.status === "awaiting_capacity"
            ? "Retry launch"
            : "Start pipeline"}
      </button>
    );
  }

  if (session.status === "stalled") {
    const hasPipelinePr = events.some(
      (event) =>
        event.kind === "first_pr_opened" ||
        event.kind === "pr_opened" ||
        event.kind === "pr_merged"
    );
    const stalledStage = readLatestStalledStage(events);

    if (!hasPipelinePr) {
      const resumeProvision = stalledStage === "bootstrap";
      return (
        <button
          className={styles.button}
          disabled={pendingAction !== null}
          onClick={resumeProvision ? onProvision : onStartBuild}
          type="button"
        >
          {pendingAction === (resumeProvision ? "provision" : "start_build")
            ? "Retrying..."
            : resumeProvision
              ? "Retry bootstrap"
              : "Retry launch"}
        </button>
      );
    }

    return (
      <>
        {session.github_repo_url ? (
          <a
            className={styles.linkButton}
            href={session.github_repo_url}
            rel="noreferrer"
            target="_blank"
          >
            Open repo
          </a>
        ) : null}
        <a
          className={styles.linkButton}
          href={`mailto:${readSupportEmail()}?subject=${encodeURIComponent(`prd-to-prod stalled run ${session.id}`)}`}
        >
          Request help
        </a>
      </>
    );
  }

  if (session.status === "complete") {
    if (isDemo) {
      return (
        <div className={styles.conversionNudge}>
          <p className={styles.nudgeText}>
            That was a simulation. Ready for the real thing?
          </p>
          <a
            className={styles.button}
            href="mailto:kahessay@icloud.com?subject=PRD%20Submission"
          >
            Send your PRD — $1
          </a>
        </div>
      );
    }
    if (session.deploy_url) {
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
  }

  return null;
}

function AccessCodeForm({ sessionId, onRedeemed }: { sessionId: string; onRedeemed: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await buildApi.redeemCode(sessionId, code.trim());
      onRedeemed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to redeem code");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.gateForm}>
      <p className={styles.gateLabel}>Enter your access code to continue</p>
      <div className={styles.gateRow}>
        <input
          className={styles.gateInput}
          type="text"
          placeholder="BETA-XXXXXXXX"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          disabled={submitting}
        />
        <button
          className={styles.button}
          disabled={submitting || code.trim().length < 4}
          onClick={handleSubmit}
          type="button"
        >
          {submitting ? "Redeeming..." : "Redeem"}
        </button>
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}

function ByokForm({ sessionId, onSubmitted }: { sessionId: string; onSubmitted: () => void }) {
  const [copilotToken, setCopilotToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await buildApi.submitCredentials(sessionId, {
        COPILOT_GITHUB_TOKEN: copilotToken.trim(),
      });
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to store credentials");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.gateForm}>
      <p className={styles.gateLabel}>Configure your pipeline</p>
      <p className={styles.copy}>
        Paste a GitHub personal access token with Copilot scope.
        This token powers the AI agents that build your app.
      </p>
      <div className={styles.gateRow}>
        <input
          className={styles.gateInput}
          type="password"
          placeholder="ghp_..."
          value={copilotToken}
          onChange={(e) => setCopilotToken(e.target.value)}
          disabled={submitting}
        />
        <button
          className={styles.button}
          disabled={submitting || copilotToken.trim().length < 10}
          onClick={handleSubmit}
          type="button"
        >
          {submitting ? "Saving..." : "Continue"}
        </button>
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
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

  if (
    event.category === "provision" &&
    (event.kind === "app_installed" || event.kind === "bootstrap_started")
  ) {
    return {
      ...session,
      status: "bootstrapping",
      app_installation_id:
        typeof event.data.installationId === "number"
          ? event.data.installationId
          : session.app_installation_id,
    };
  }

  if (event.category === "provision" && event.kind === "bootstrap_complete") {
    return {
      ...session,
      status: "ready_to_launch",
      deploy_url:
        typeof event.data.deploy_url === "string"
          ? event.data.deploy_url
          : session.deploy_url,
    };
  }

  if (event.category === "build" && event.kind === "capacity_waitlisted") {
    return {
      ...session,
      status: "awaiting_capacity",
    };
  }

  if (
    event.category === "build" &&
    (event.kind === "pipeline_started" || event.kind === "agent_started")
  ) {
    return {
      ...session,
      status: "building",
    };
  }

  if (event.category === "delivery" && (event.kind === "handoff_ready" || event.kind === "complete")) {
    return {
      ...session,
      status: "complete",
      deploy_url:
        typeof event.data.deploy_url === "string"
          ? event.data.deploy_url
          : session.deploy_url,
    };
  }

  if (
    (event.category === "build" || event.category === "delivery" || event.category === "provision") &&
    (event.kind === "agent_error" || event.kind === "pipeline_stalled")
  ) {
    return {
      ...session,
      status: "stalled",
    };
  }

  return session;
}

function parseBuildStatus(value: string): BuildSessionStatus {
  if (
    value === "refining" ||
    value === "ready" ||
    value === "awaiting_install" ||
    value === "bootstrapping" ||
    value === "ready_to_launch" ||
    value === "awaiting_capacity" ||
    value === "building" ||
    value === "complete" ||
    value === "stalled" ||
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
    return "Creating the root issue and dispatching the target-repo pipeline.";
  }

  if (status === "ready") {
    return "Your PRD is finalized. The next step is provisioning a repository from the public beta scaffold.";
  }

  if (status === "awaiting_install") {
    return "The repository exists, but the GitHub App still needs access before bootstrap can continue.";
  }

  if (status === "bootstrapping") {
    return "The GitHub App is installed and bootstrap is configuring labels, secrets, variables, and repo memory.";
  }

  if (status === "ready_to_launch") {
    return "Bootstrap is complete. Start the pipeline to create the root PRD issue and launch decomposition.";
  }

  if (status === "awaiting_capacity") {
    return "This repo is ready, but the shared beta capacity is full. Retry launch when a slot opens.";
  }

  if (status === "building") {
    return "The target repo is running the pipeline. New events will appear here as GitHub reports progress.";
  }

  if (status === "complete") {
    return "The build finished successfully. Use the deployment link if one was reported.";
  }

  if (status === "stalled") {
    return "The pipeline stalled. Use the retry action if no PR exists yet, or open the repo and inspect the latest pipeline activity.";
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

function readLatestStalledStage(events: BuildEvent[]): string | null {
  const stalled = [...events]
    .reverse()
    .find((event) => event.kind === "pipeline_stalled");
  return typeof stalled?.data?.stage === "string" ? stalled.data.stage : null;
}

function readSupportEmail(): string {
  return process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "kahessay@icloud.com";
}

function hasParsedMessage(value: unknown): value is { message: string } {
  return Boolean(
    value &&
      typeof value === "object" &&
      "message" in value &&
      typeof value.message === "string"
  );
}
