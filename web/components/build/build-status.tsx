"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { buildApi } from "@/lib/build-api";
import {
  appendUniqueEvent,
  applyEventToSession,
  mergeUniqueEvents,
  parseBuildStatus,
  reconcileSessionSnapshot,
  readPrdTitle,
} from "@/lib/build-session-state";
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
  requestedRepoName?: string | null;
}

type PendingAction = "provision" | "start_build" | null;
const HUMAN_BOUNDARY_URL =
  "https://github.com/samuelkahessay/prd-to-prod/blob/main/autonomy-policy.yml";

export function BuildStatus({
  initialSession,
  initialEvents,
  requestedRepoName = null,
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
  const [deployConfigured, setDeployConfigured] = useState(isDemo);
  const [gatesHydrated, setGatesHydrated] = useState(isDemo);

  useEffect(() => {
    if (isDemo) return;
    buildApi.getSession(session.id).then((data) => {
      const gates = (data as {
        gates?: {
          codeRedeemed: boolean;
          credentialsSubmitted: boolean;
          deployConfigured: boolean;
        };
      }).gates;
      if (gates) {
        setCodeRedeemed(gates.codeRedeemed);
        setCredentialsSubmitted(gates.credentialsSubmitted);
        setDeployConfigured(gates.deployConfigured);
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
        event.kind === "access_code_redeemed" ||
        event.kind === "credentials_submitted" ||
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

      if (event.kind === "access_code_redeemed") {
        setCodeRedeemed(true);
      }

      if (event.kind === "credentials_submitted") {
        setCredentialsSubmitted(true);
        setDeployConfigured(Boolean(event.data.deployConfigured));
      }
    });
  }, [session.id]);

  useEffect(() => {
    let cancelled = false;

    const syncSnapshot = async () => {
      try {
        const snapshot = await buildApi.getSession(session.id);
        if (cancelled) {
          return;
        }

        setSession((previous) =>
          reconcileSessionSnapshot(previous, snapshot.session)
        );
        setEvents((previous) => mergeUniqueEvents(previous, snapshot.messages));
      } catch {
        // Ignore fallback polling failures; the live stream remains authoritative.
      }
    };

    void syncSnapshot();

    if (isSettledStatus(session.status)) {
      return () => {
        cancelled = true;
      };
    }

    const interval = window.setInterval(() => {
      void syncSnapshot();
    }, 2500);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [session.id, session.status]);

  const provisionRepo = useCallback(async () => {
    setPendingAction("provision");
    setError(null);

    try {
      const result = requestedRepoName
        ? await buildApi.provisionRepo(session.id, { repoName: requestedRepoName })
        : await buildApi.provisionRepo(session.id);
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
  }, [requestedRepoName, session.id]);

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
  const runEvidence = useMemo(() => deriveRunEvidence(events, session), [events, session]);
  const stalledEvent = useMemo(() => readLatestStalledEvent(events), [events]);
  const stalledStage =
    typeof stalledEvent?.data?.stage === "string" ? stalledEvent.data.stage : null;

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
                : session.github_repo_url
                  ? (
                    <a
                      className={styles.inlineLink}
                      href={session.github_repo_url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {session.github_repo}
                    </a>
                  )
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
              : deployConfigured
                ? "Configured — waiting for validated URL"
                : "Optional — this run can finish at repo handoff"}
          </div>
        </article>
        <article className={styles.card}>
          <span className={styles.label}>Beta flow</span>
          <div className={styles.value}>
            {isDemo
              ? "Simulation"
              : deployConfigured
                ? "BYOK build + deploy validation"
                : "BYOK build + repo handoff"}
          </div>
        </article>
        {session.status === "stalled" ? (
          <article className={styles.card}>
            <span className={styles.label}>Stalled at</span>
            <div className={styles.value}>
              {stalledStage ? formatStageName(stalledStage) : "Pipeline"}
            </div>
            <p className={styles.inlineNote}>
              {stalledEvent?.kind === "provider_retry_exhausted"
                ? "The retry budget is exhausted for this stage. Inspect the repo activity before retrying."
                : "Use the retry action below if the repo has no open pipeline PR yet."}
            </p>
          </article>
        ) : null}
      </section>

      {!isDemo ? (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Human boundary</h2>
          <div className={styles.card}>
            <p className={styles.copy}>
              Humans still own policy, workflow authority, secrets, deployment routing, and any expansion of scope.
              Agents only execute inside those guardrails.
            </p>
            <div className={styles.actions}>
              <a
                className={styles.linkButton}
                href={HUMAN_BOUNDARY_URL}
                rel="noreferrer"
                target="_blank"
              >
                Read autonomy policy
              </a>
            </div>
          </div>
        </section>
      ) : null}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Factory floor</h2>
        <FactoryScene events={events} key={session.id} />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Run evidence</h2>
        <div className={styles.card}>
          <div className={styles.evidenceList}>
            {runEvidence.map((item) => (
              <div key={item.label} className={styles.evidenceItem}>
                <span className={`${styles.evidenceDot} ${item.complete ? styles.evidenceDone : ""}`} />
                <div>
                  <div className={styles.evidenceLabel}>{item.label}</div>
                  <div className={styles.evidenceDetail}>{item.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
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
          {session.status === "stalled" && stalledStage ? (
            <p className={styles.inlineNote}>
              Latest stalled stage: {formatStageName(stalledStage)}.
            </p>
          ) : null}

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
              deployConfigured,
              onCodeRedeemed: () => setCodeRedeemed(true),
              onCredentialsSubmitted: (nextDeployConfigured) => {
                setCredentialsSubmitted(true);
                setDeployConfigured(nextDeployConfigured);
              },
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
  deployConfigured,
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
  deployConfigured: boolean;
  onCodeRedeemed: () => void;
  onCredentialsSubmitted: (deployConfigured: boolean) => void;
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
            That was a simulation. Ready for the invite-only beta?
          </p>
          <a
            className={styles.button}
            href="mailto:kahessay@icloud.com?subject=PRD%20Submission"
          >
            Request beta access — $1
          </a>
        </div>
      );
    }
    if (session.deploy_url) {
      return renderSuccessLinks(session, true);
    }
  }

  if (session.status === "handoff_ready") {
    return renderSuccessLinks(session, deployConfigured);
  }

  return null;
}

function renderSuccessLinks(session: BuildSession, deployConfigured: boolean) {
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
      {session.deploy_url ? (
        <a
          className={styles.linkButton}
          href={session.deploy_url}
          rel="noreferrer"
          target="_blank"
        >
          Open deployed app
        </a>
      ) : null}
      {!session.deploy_url && !deployConfigured ? (
        <span className={styles.inlineNote}>
          Deployment was skipped. Add Vercel credentials on a future run if you want validated deploy output.
        </span>
      ) : null}
      {!session.deploy_url && deployConfigured ? (
        <span className={styles.inlineNote}>
          Deployment credentials were present, but no validated URL was reported. Inspect the repo workflows for the missing deployment output.
        </span>
      ) : null}
    </>
  );
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
      <p className={styles.gateLabel}>Enter your single-use access code</p>
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

function ByokForm({
  sessionId,
  onSubmitted,
}: {
  sessionId: string;
  onSubmitted: (deployConfigured: boolean) => void;
}) {
  const [agentApiKey, setAgentApiKey] = useState("");
  const [vercelToken, setVercelToken] = useState("");
  const [vercelOrgId, setVercelOrgId] = useState("");
  const [vercelProjectId, setVercelProjectId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    const nextDeployConfigured =
      vercelToken.trim().length > 0 &&
      vercelOrgId.trim().length > 0 &&
      vercelProjectId.trim().length > 0;
    try {
      await buildApi.submitCredentials(sessionId, {
        OPENAI_API_KEY: agentApiKey.trim(),
        ...(vercelToken.trim() ? { VERCEL_TOKEN: vercelToken.trim() } : {}),
        ...(vercelOrgId.trim() ? { VERCEL_ORG_ID: vercelOrgId.trim() } : {}),
        ...(vercelProjectId.trim() ? { VERCEL_PROJECT_ID: vercelProjectId.trim() } : {}),
      });
      onSubmitted(nextDeployConfigured);
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
        Paste your OpenAI API key. The pipeline stores it as `OPENAI_API_KEY` for gh-aw and the public beta build flow.
        Vercel credentials are optional; without them, the run still finishes in repo handoff mode.
      </p>
      <div className={styles.gateFormFields}>
        <input
          className={styles.gateInput}
          type="password"
          placeholder="sk-..."
          value={agentApiKey}
          onChange={(e) => setAgentApiKey(e.target.value)}
          disabled={submitting}
        />
      </div>
      <div className={styles.gateGrid}>
        <input
          className={styles.gateInput}
          type="password"
          placeholder="VERCEL_TOKEN (optional)"
          value={vercelToken}
          onChange={(e) => setVercelToken(e.target.value)}
          disabled={submitting}
        />
        <input
          className={styles.gateInput}
          type="text"
          placeholder="VERCEL_ORG_ID (optional)"
          value={vercelOrgId}
          onChange={(e) => setVercelOrgId(e.target.value)}
          disabled={submitting}
        />
        <input
          className={styles.gateInput}
          type="text"
          placeholder="VERCEL_PROJECT_ID (optional)"
          value={vercelProjectId}
          onChange={(e) => setVercelProjectId(e.target.value)}
          disabled={submitting}
        />
      </div>
      <div className={styles.actions}>
        <button
          className={styles.button}
          disabled={submitting || agentApiKey.trim().length < 10}
          onClick={handleSubmit}
          type="button"
        >
          {submitting ? "Saving..." : "Continue"}
        </button>
        <span className={styles.inlineNote}>
          {vercelToken || vercelOrgId || vercelProjectId
            ? "All three Vercel values are required for deployment validation."
            : "Leave the Vercel fields blank to run in repo handoff mode."}
        </span>
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
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

  if (status === "handoff_ready") {
    return "The beta run finished successfully and the repo is ready for handoff. Deployment was skipped or left unvalidated for this run.";
  }

  if (status === "complete") {
    return "The beta run finished successfully and the deployment URL was validated.";
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

function readLatestStalledEvent(events: BuildEvent[]): BuildEvent | null {
  return (
    [...events]
      .reverse()
      .find(
        (event) =>
          event.kind === "pipeline_stalled" ||
          event.kind === "provider_retry_exhausted"
      ) || null
  );
}

function readLatestStalledStage(events: BuildEvent[]): string | null {
  const stalled = readLatestStalledEvent(events);
  return typeof stalled?.data?.stage === "string" ? stalled.data.stage : null;
}

function formatStageName(stage: string): string {
  if (stage === "decompose") return "Decomposition";
  if (stage === "implementation") return "Implementation";
  if (stage === "review") return "Review";
  if (stage === "deploy") return "Deployment";
  if (stage === "bootstrap") return "Bootstrap";
  if (stage === "provision") return "Provisioning";
  return stage.charAt(0).toUpperCase() + stage.slice(1);
}

function isSettledStatus(status: BuildSessionStatus): boolean {
  return (
    status === "complete" ||
    status === "handoff_ready" ||
    status === "stalled" ||
    status === "failed"
  );
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

function deriveRunEvidence(events: BuildEvent[], session: BuildSession) {
  return [
    {
      label: "Access code redeemed",
      complete: events.some((event) => event.kind === "access_code_redeemed"),
      detail: events.some((event) => event.kind === "access_code_redeemed")
        ? "Entitlement recorded for this beta session."
        : "Required before provisioning a real run.",
    },
    {
      label: "BYOK credentials submitted",
      complete: events.some((event) => event.kind === "credentials_submitted"),
      detail: events.some((event) => event.kind === "credentials_submitted")
        ? "Agent credentials are stored for this run."
        : "OpenRouter key required. Vercel credentials optional.",
    },
    {
      label: "Repo created",
      complete: events.some((event) => event.kind === "repo_created"),
      detail: session.github_repo || "Waiting for provisioning.",
    },
    {
      label: "App installed",
      complete: events.some((event) => event.kind === "app_installed"),
      detail: events.some((event) => event.kind === "app_installed")
        ? "GitHub App access confirmed."
        : "Bootstrap cannot continue until the app is installed.",
    },
    {
      label: "Bootstrap complete",
      complete: events.some((event) => event.kind === "bootstrap_complete"),
      detail: events.some((event) => event.kind === "bootstrap_complete")
        ? "Labels, secrets, variables, and repo memory are configured."
        : "Preparing the target repo for the pipeline.",
    },
    {
      label: "Decomposer started",
      complete: events.some((event) => event.kind === "pipeline_started"),
      detail: events.some((event) => event.kind === "pipeline_started")
        ? "Root PRD issue created and dispatched."
        : "Waiting to launch decomposition.",
    },
    {
      label: "Child issues created",
      complete: events.some((event) => event.kind === "child_issue_tracked"),
      detail: readEvidenceCount(events, "child_issue_tracked", "issue"),
    },
    {
      label: "First PR opened",
      complete: events.some((event) => event.kind === "first_pr_opened" || event.kind === "pr_opened"),
      detail: events.some((event) => event.kind === "first_pr_opened" || event.kind === "pr_opened")
        ? "Implementation reached pull-request stage."
        : "No pipeline PR has opened yet.",
    },
    {
      label: "Delivery outcome",
      complete: session.status === "handoff_ready" || session.status === "complete",
      detail:
        session.status === "complete"
          ? "Deployment validated and ready to open."
          : events.some((event) => event.kind === "deployment_skipped")
            ? "Deployment skipped; repo handoff is ready."
            : "Run still in progress.",
    },
  ];
}

function readEvidenceCount(events: BuildEvent[], kind: string, noun: string) {
  const total = events.filter((event) => event.kind === kind).length;
  if (total === 0) {
    return `No ${noun}s recorded yet.`;
  }
  return `${total} ${noun}${total === 1 ? "" : "s"} recorded.`;
}
