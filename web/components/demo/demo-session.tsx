"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { PrdToProdAnimation } from "@/components/shared/prd-to-prod-animation";
import type { DemoReplayPreset } from "@/lib/demo-preset";
import type { BuildEvent, BuildSession, BuildSessionStatus } from "@/lib/types";
import {
  deriveDemoProofSummary,
  isTerminalStatus,
} from "./demo-proof";
import styles from "./demo-session.module.css";

interface DemoSessionProps {
  initialSession: BuildSession;
  initialEvents: BuildEvent[];
  requestedRepoName?: string | null;
  replayPreset?: DemoReplayPreset;
}

type PendingAction = "provision" | "start_build" | null;

export function DemoSession({
  initialSession,
  initialEvents,
  requestedRepoName = null,
  replayPreset = "demo",
}: DemoSessionProps) {
  const [session, setSession] = useState(initialSession);
  const [events, setEvents] = useState(initialEvents);
  const [playedSession, setPlayedSession] = useState(() =>
    createPlaybackBaseline(initialSession)
  );
  const [playedEvents, setPlayedEvents] = useState<BuildEvent[]>([]);
  const [lastPlaybackEvent, setLastPlaybackEvent] = useState<BuildEvent | null>(
    null
  );
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [proofVisible, setProofVisible] = useState(false);
  const autoProvisionedRef = useRef(false);
  const autoBuildStartedRef = useRef(false);

  useEffect(() => {
    return buildApi.streamBuildEvents(session.id, (event) => {
      setEvents((previous) => appendUniqueEvent(previous, event));
      setSession((previous) => applyEventToSession(previous, event));
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
        // Ignore snapshot failures and continue relying on SSE/live state.
      }
    };

    void syncSnapshot();

    if (isTerminalStatus(session.status)) {
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
    } catch (nextError) {
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
      session.status !== "ready_to_launch" ||
      autoBuildStartedRef.current ||
      pendingAction !== null
    ) {
      return;
    }

    autoBuildStartedRef.current = true;
    void startBuild();
  }, [pendingAction, session.status, startBuild]);

  useEffect(() => {
    if (!isTerminalStatus(playedSession.status)) {
      setProofVisible(false);
      return;
    }

    const timer = window.setTimeout(() => setProofVisible(true), 900);
    return () => window.clearTimeout(timer);
  }, [playedSession.status]);

  const title =
    readPrdTitle(initialSession.prd_final) || `Demo ${initialSession.id.slice(0, 8)}`;
  const repoUrl = playedSession.github_repo_url || session.github_repo_url;
  const deployUrl = playedSession.deploy_url || session.deploy_url;
  const stats = useMemo(() => derivePlayedStats(playedEvents), [playedEvents]);
  const proof = useMemo(
    () => deriveDemoProofSummary(playedSession, playedEvents),
    [playedEvents, playedSession]
  );
  const beat = describeDemoBeat(playedSession.status, pendingAction, lastPlaybackEvent);

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.headerCopy}>
            <div className={styles.kickerRow}>
              <span className={styles.kicker}>Guided demo</span>
              <span className={styles.kickerDivider} />
              <span className={styles.kickerMuted}>factory floor replay</span>
            </div>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.subtitle}>
              Five agents, one room, one governed build. The floor is the demo.
            </p>
          </div>

          <div className={styles.animationDock}>
            <PrdToProdAnimation size={56} amplitude="full" rotation squashPropagation />
          </div>
        </header>

        <section className={styles.stageCard} data-capture="factory-floor">
          <div className={styles.stageHeader}>
            <div>
              <div className={styles.stageLabel}>On the floor now</div>
              <div className={styles.stageBeat}>{beat}</div>
            </div>
            <div className={styles.metricRail}>
              <span className={styles.metricChip}>
                {stats.issues} issue{stats.issues === 1 ? "" : "s"}
              </span>
              <span className={styles.metricChip}>
                {stats.prs} PR{stats.prs === 1 ? "" : "s"}
              </span>
              <span className={styles.metricChip}>{formatSessionState(playedSession.status)}</span>
            </div>
          </div>

          <FactoryScene
            events={events}
            playbackMode="cinematic"
            replayProfile={replayPreset}
            height={560}
            onPlaybackEvent={(event) => {
              setLastPlaybackEvent(event);
              setPlayedEvents((previous) => appendUniqueEvent(previous, event));
              setPlayedSession((previous) => applyEventToSession(previous, event));
            }}
          />
        </section>

        <section className={styles.lowerGrid}>
          <article className={styles.infoCard}>
            <div className={styles.cardLabel}>Sequence</div>
            <p className={styles.cardCopy}>
              The floor replays provisioning, implementation, review, and delivery
              on cinematic timing rather than raw pipeline wall-clock timing.
            </p>
            <div className={styles.statusList}>
              <div className={styles.statusItem}>
                <span className={styles.statusDot} />
                <span>Repo provisioning auto-starts</span>
              </div>
              <div className={styles.statusItem}>
                <span className={styles.statusDot} />
                <span>Pipeline launch auto-follows bootstrap</span>
              </div>
              <div className={styles.statusItem}>
                <span className={styles.statusDot} />
                <span>Proof waits until the visual replay reaches terminal state</span>
              </div>
              <div className={styles.statusItem}>
                <span className={styles.statusDot} />
                <span>
                  {replayPreset === "recording"
                    ? "Recording preset locks ambient timing for repeatable takes"
                    : "Reduced motion keeps the proof path intact and strips spectacle"}
                </span>
              </div>
            </div>
            {error ? <p className={styles.error}>{error}</p> : null}
          </article>

          <article
            className={`${styles.proofCard} ${
              proofVisible ? styles.proofCardVisible : ""
            }`}
            aria-live="polite"
            data-capture="proof-endcap"
            data-proof-ready={proofVisible ? "true" : "false"}
          >
            <div className={styles.cardLabel}>Proof</div>
            <div className={styles.proofTitle}>
              {proofVisible ? "Build complete" : "Proof incoming"}
            </div>
            <p className={styles.cardCopy}>
              {proofVisible
                ? "The floor celebration is backed by a real repo and final run state."
                : "Let the room finish the story, then cut to the repo and deployment proof."}
            </p>

            <div className={styles.proofStepRail}>
              {proof.steps.map((step) => (
                <span
                  key={step.id}
                  className={`${styles.proofStep} ${
                    step.done ? styles.proofStepDone : ""
                  }`}
                >
                  {step.label}
                </span>
              ))}
            </div>

            <div className={styles.proofFacts}>
              {proof.facts.map((fact) => (
                <div key={fact.id} className={styles.fact}>
                  <span className={styles.factLabel}>{fact.label}</span>
                  {fact.href ? (
                    <a
                      className={styles.factLink}
                      href={fact.href}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {fact.value}
                    </a>
                  ) : (
                    <span className={styles.factValue}>{fact.value}</span>
                  )}
                  <span className={styles.factNote}>{fact.note}</span>
                </div>
              ))}
            </div>

            <div className={styles.proofTrail}>
              {proof.trail.map((beat) => (
                <div key={beat.id} className={styles.proofTrailItem}>
                  <span className={styles.proofTrailLabel}>{beat.label}</span>
                  {beat.href ? (
                    <a
                      className={styles.proofTrailLink}
                      href={beat.href}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {beat.detail}
                    </a>
                  ) : (
                    <span className={styles.proofTrailDetail}>{beat.detail}</span>
                  )}
                </div>
              ))}
            </div>

            <div className={styles.actions}>
              {repoUrl ? (
                <a
                  className={styles.actionSecondary}
                  href={repoUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open repo
                </a>
              ) : null}
              {deployUrl ? (
                <a
                  className={styles.actionPrimary}
                  href={deployUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open deployed app
                </a>
              ) : (
                <span className={styles.inlineNote}>
                  Demo mode ends with repo proof even when deploy proof is absent.
                </span>
              )}
            </div>
          </article>
        </section>
      </div>
    </div>
  );
}

function createPlaybackBaseline(session: BuildSession): BuildSession {
  return {
    ...session,
    status: session.prd_final ? "ready" : session.status,
    github_repo: null,
    github_repo_id: null,
    github_repo_url: null,
    deploy_url: null,
    app_installation_id: null,
  };
}

function derivePlayedStats(events: BuildEvent[]) {
  const issues = events.filter((event) => event.kind === "prd_issue_created").length;
  const latestPrCount = [...events]
    .reverse()
    .find((event) => event.kind === "pr_opened");

  return {
    issues,
    prs:
      typeof latestPrCount?.data?.pr_count === "number"
        ? latestPrCount.data.pr_count
        : events.filter((event) => event.kind === "pr_opened").length,
  };
}

function describeDemoBeat(
  status: BuildSessionStatus,
  pendingAction: PendingAction,
  lastPlaybackEvent: BuildEvent | null
): string {
  if (pendingAction === "provision") {
    return "Spinning up the room and provisioning the repo";
  }

  if (pendingAction === "start_build") {
    return "Dispatching the root issue and waking the floor";
  }

  if (!lastPlaybackEvent) {
    if (status === "ready") {
      return "PRD locked. The room is about to wake up.";
    }

    return "Loading the cinematic replay.";
  }

  if (lastPlaybackEvent.kind === "repo_created") {
    return "Planner just claimed the brief and opened the room";
  }

  if (lastPlaybackEvent.kind === "bootstrap_complete") {
    return "The floor is configured and ready for pipeline work";
  }

  if (lastPlaybackEvent.kind === "pr_opened") {
    return "A pull request just moved into inspection";
  }

  if (lastPlaybackEvent.kind === "pr_reviewed") {
    return "Review is in and the room is lining up the merge";
  }

  if (lastPlaybackEvent.kind === "pr_merged") {
    return "The merge landed and deployment prep just took over";
  }

  if (lastPlaybackEvent.kind === "deployed") {
    return "Deployment is live. The room is converging for the finish";
  }

  if (lastPlaybackEvent.kind === "complete") {
    return "Confetti, banner, proof";
  }

  if (status === "building") {
    return "Agents are actively building through the queue";
  }

  if (status === "complete" || status === "handoff_ready") {
    return "The floor finished cleanly and the proof panel is live";
  }

  return "The room is moving through the build sequence";
}

function formatSessionState(status: BuildSessionStatus): string {
  if (status === "ready_to_launch") return "ready to launch";
  if (status === "awaiting_capacity") return "capacity wait";
  if (status === "handoff_ready") return "handoff ready";
  return status.replace(/_/g, " ");
}
