const crypto = require("crypto");
const { deactivatePipeline } = require("../lib/pipeline-lifecycle");

function verifySignature(secret, payload, signature) {
  if (!secret || !Buffer.isBuffer(payload) || typeof signature !== "string") {
    return false;
  }
  const expected =
    "sha256=" +
    crypto.createHmac("sha256", secret).update(payload).digest("hex");
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

function registerWebhookRoutes(app, { db, buildSessionStore, serviceResolver }) {
  const secret = process.env.GITHUB_APP_WEBHOOK_SECRET;

  app.post("/webhooks/github-app", async (req, res) => {
    if (!secret) {
      return res.status(503).json({ error: "Webhook secret not configured" });
    }

    const signature = req.headers["x-hub-signature-256"];
    const rawBody = req.body;

    if (!verifySignature(secret, rawBody, signature)) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    let payload;
    try {
      payload = JSON.parse(rawBody.toString("utf8"));
    } catch {
      return res.status(400).json({ error: "Invalid JSON" });
    }

    const event = readHeader(req.headers["x-github-event"]);
    const deliveryId = readHeader(req.headers["x-github-delivery"]) || crypto.randomUUID();
    const action = payload.action || "";
    const repositoryId = payload.repository?.id || firstRepoId(payload);
    const installationId = payload.installation?.id || null;

    const inserted = buildSessionStore.recordWebhookDelivery({
      deliveryId,
      eventName: event,
      action,
      repositoryId,
      installationId,
      payload,
    });
    if (!inserted) {
      return res.status(200).json({ ok: true, duplicate: true });
    }

    try {
      await routeWebhookEvent({
        db,
        buildSessionStore,
        serviceResolver,
        event,
        action,
        payload,
        repositoryId,
        installationId,
      });
    } catch (error) {
      console.error("GitHub webhook handling failed:", error);
    }

    res.status(200).json({ ok: true });
  });
}

async function routeWebhookEvent({
  db,
  buildSessionStore,
  serviceResolver,
  event,
  action,
  payload,
  repositoryId,
  installationId,
}) {
  if (
    (event === "installation_repositories" && action === "added") ||
    (event === "installation" && action === "created")
  ) {
    const repositories =
      payload.repositories_added || payload.repositories || [];
    for (const repo of repositories) {
      await handleInstallation(repo.id, installationId, buildSessionStore, serviceResolver);
    }
    return;
  }

  const session = buildSessionStore.findSessionByRepoId(repositoryId, {
    statuses: [
      "awaiting_install",
      "bootstrapping",
      "ready_to_launch",
      "awaiting_capacity",
      "building",
      "stalled",
    ],
  });
  if (!session) {
    return;
  }

  if (event === "issues") {
    handleIssueEvent(buildSessionStore, session, action, payload);
    return;
  }

  if (event === "pull_request") {
    handlePullRequestEvent(buildSessionStore, session, action, payload);
    return;
  }

  if (event === "issue_comment") {
    handleIssueCommentEvent(buildSessionStore, session, action, payload);
    return;
  }

  if (event === "workflow_run") {
    handleWorkflowRunEvent(buildSessionStore, serviceResolver, session, action, payload);
    return;
  }

  if (event === "push") {
    handlePushEvent(buildSessionStore, session, payload);
  }
}

async function handleInstallation(repoId, installationId, buildSessionStore, serviceResolver) {
  if (!repoId || !installationId) {
    return;
  }

  const session = buildSessionStore.findSessionByRepoId(repoId, {
    statuses: ["awaiting_install", "bootstrapping", "stalled"],
  });
  if (!session) {
    return;
  }

  try {
    await serviceResolver
      .forSession(session.id)
      .provisioner.resumeAppBootstrap(session.id, installationId);
  } catch (error) {
    buildSessionStore.updateSession(session.id, { status: "stalled" });
    buildSessionStore.appendEvent(session.id, {
      category: "provision",
      kind: "pipeline_stalled",
      data: {
        stage: "bootstrap",
        detail: `Bootstrap resume failed after app installation: ${error.message}`,
      },
    });
  }
}

function handleIssueEvent(buildSessionStore, session, action, payload) {
  const issue = payload.issue;
  if (!issue?.number) {
    return;
  }

  const isRootIssue = buildSessionStore
    .getRefs(session.id, { type: "issue", key: "root" })
    .some((ref) => ref.ref_value === String(issue.number));
  const labels = issue.labels?.map((label) => label.name) || [];

  if (isRootIssue) {
    return;
  }

  if (labels.includes("pipeline") || action === "opened") {
    buildSessionStore.upsertRef(session.id, {
      type: "issue",
      key: "child",
      value: String(issue.number),
      metadata: {
        issueUrl: issue.html_url,
        title: issue.title,
        state: issue.state,
      },
    });

    buildSessionStore.appendEvent(session.id, {
      category: "build",
      kind: "child_issue_tracked",
      data: {
        issueNumber: issue.number,
        issueUrl: issue.html_url,
        detail: `Tracking child issue #${issue.number}: ${issue.title}`,
      },
    });
  }
}

function handlePullRequestEvent(buildSessionStore, session, action, payload) {
  const pr = payload.pull_request;
  if (!pr?.number) {
    return;
  }

  const existing = buildSessionStore
    .getRefs(session.id, { type: "pull_request" })
    .some((ref) => ref.ref_value === String(pr.number));

  buildSessionStore.upsertRef(session.id, {
    type: "pull_request",
    key: "pipeline",
    value: String(pr.number),
    metadata: {
      prUrl: pr.html_url,
      title: pr.title,
      merged: Boolean(pr.merged),
      state: pr.state,
    },
  });

  if (action === "opened" && !existing) {
    buildSessionStore.appendEvent(session.id, {
      category: "build",
      kind: "first_pr_opened",
      data: {
        prNumber: pr.number,
        prUrl: pr.html_url,
        detail: `First pipeline PR opened: #${pr.number}`,
      },
    });
    return;
  }

  if (action === "closed" && pr.merged) {
    buildSessionStore.appendEvent(session.id, {
      category: "build",
      kind: "pr_merged",
      data: {
        prNumber: pr.number,
        prUrl: pr.html_url,
        detail: `Pipeline PR merged: #${pr.number}`,
      },
    });
  }
}

function handleIssueCommentEvent(buildSessionStore, session, action, payload) {
  if (action !== "created") {
    return;
  }
  if (!payload.issue?.pull_request) {
    return;
  }

  const body = payload.comment?.body || "";
  if (!body.startsWith("[PIPELINE-VERDICT]")) {
    return;
  }

  const verdict = body.match(/\*\*VERDICT:\s*(APPROVE|REQUEST_CHANGES)/)?.[1] || "REQUEST_CHANGES";
  buildSessionStore.appendEvent(session.id, {
    category: "build",
    kind: "review_verdict_received",
    data: {
      verdict,
      prNumber: payload.issue.number,
      detail: `Review verdict for PR #${payload.issue.number}: ${verdict}`,
    },
  });

  if (verdict === "REQUEST_CHANGES") {
    buildSessionStore.updateSession(session.id, { status: "stalled" });
    buildSessionStore.appendEvent(session.id, {
      category: "build",
      kind: "pipeline_stalled",
      data: {
        stage: "review",
        detail: `Pipeline review requested changes on PR #${payload.issue.number}`,
      },
    });
  }
}

function handleWorkflowRunEvent(buildSessionStore, serviceResolver, session, action, payload) {
  const run = payload.workflow_run;
  if (!run?.id || !run?.name) {
    return;
  }

  const stage = workflowStage(run.name);

  // Always track ref for meaningful workflows; skip infrastructure noise entirely
  if (stage !== "noise") {
    buildSessionStore.upsertRef(session.id, {
      type: "workflow_run",
      key: run.name,
      value: String(run.id),
      metadata: {
        url: run.html_url,
        status: run.status,
        conclusion: run.conclusion,
      },
    });
  }

  // --- in_progress: emit agent_started for meaningful workflows ---
  if (action === "requested" || action === "in_progress") {
    if (run.name === "Deploy to Vercel") {
      buildSessionStore.appendEvent(session.id, {
        category: "delivery",
        kind: "deploy_started",
        data: {
          workflowRunId: run.id,
          workflowRunUrl: run.html_url,
          detail: "Deployment workflow started.",
        },
      });
    } else if (stage === "decompose" || stage === "implementation" || stage === "review") {
      buildSessionStore.appendEvent(session.id, {
        category: "build",
        kind: "agent_started",
        data: {
          stage,
          workflowRunId: run.id,
          workflowRunUrl: run.html_url,
          detail: `${run.name} is running.`,
        },
      });
    }
    return;
  }

  if (action !== "completed") {
    return;
  }

  // --- completed: suppress noise workflows entirely ---
  if (stage === "noise") {
    return;
  }

  // --- completed + success: emit agent_completed ---
  if (run.conclusion === "success") {
    if (stage === "decompose" || stage === "implementation" || stage === "review") {
      buildSessionStore.appendEvent(session.id, {
        category: "build",
        kind: "agent_completed",
        data: {
          stage,
          workflowRunId: run.id,
          workflowRunUrl: run.html_url,
          detail: `${run.name} completed successfully.`,
        },
      });
    }
    // Fall through to deployment-specific success handling below
  }

  // --- completed + skipped: silent ---
  if (run.conclusion === "skipped") {
    return;
  }

  // --- completed + failure/cancelled/timed_out on meaningful workflows ---
  const failureCount = buildSessionStore
    .getRefs(session.id, { type: "workflow_run", key: run.name })
    .filter((ref) =>
      ["failure", "cancelled", "timed_out"].includes(ref.metadata?.conclusion)
    ).length;

  if (run.conclusion === "failure" || run.conclusion === "cancelled" || run.conclusion === "timed_out") {
    // Cancellations on implementation agents are normal (concurrency groups); don't stall
    if (run.conclusion === "cancelled" && stage === "implementation") {
      return;
    }

    buildSessionStore.updateSession(session.id, { status: "stalled" });
    buildSessionStore.appendEvent(session.id, {
      category: stage === "deploy" ? "delivery" : "build",
      kind:
        stage === "implementation" && failureCount >= 3
          ? "provider_retry_exhausted"
          : "pipeline_stalled",
      data: {
        stage,
        workflowRunId: run.id,
        workflowRunUrl: run.html_url,
        attemptCount: failureCount,
        detail:
          stage === "implementation" && failureCount >= 3
            ? `${run.name} exhausted the beta retry budget after ${failureCount} failed attempts.`
            : `${run.name} completed with ${run.conclusion}.`,
      },
    });
    return;
  }

  if (run.name === "Validate Deployment" && run.conclusion === "success") {
    const productionUrl =
      buildSessionStore.getRefs(session.id, { type: "vercel_project", key: "production_url" }).at(-1)?.ref_value ||
      session.deploy_url;

    if (productionUrl) {
      buildSessionStore.updateSession(session.id, {
        status: "complete",
        deploy_url: productionUrl,
      });
      buildSessionStore.appendEvent(session.id, {
        category: "delivery",
        kind: "complete",
        data: {
          deploy_url: productionUrl,
          workflowRunId: run.id,
          workflowRunUrl: run.html_url,
          detail: "Deployment validated. The beta run is complete.",
        },
      });
      deactivatePipeline(serviceResolver, session);
      return;
    }

    buildSessionStore.appendEvent(session.id, {
      category: "delivery",
      kind: "deployment_skipped",
      data: {
        workflowRunId: run.id,
        workflowRunUrl: run.html_url,
        detail: "Deployment validation skipped because no deployment URL is configured for this beta run.",
      },
    });
    buildSessionStore.updateSession(session.id, {
      status: "handoff_ready",
    });
    buildSessionStore.appendEvent(session.id, {
      category: "delivery",
      kind: "handoff_ready",
      data: {
        workflowRunId: run.id,
        workflowRunUrl: run.html_url,
        detail: "Repo handoff is ready. Deployment was not configured for this beta run.",
      },
    });
    deactivatePipeline(serviceResolver, session);
  }
}

function handlePushEvent(buildSessionStore, session, payload) {
  if (payload.ref !== "refs/heads/main") {
    return;
  }

  buildSessionStore.appendEvent(session.id, {
    category: "build",
    kind: "main_updated",
    data: {
      detail: "A new commit landed on main.",
      after: payload.after,
    },
  });
}

function workflowStage(name) {
  if (name === "PRD Decomposer") return "decompose";
  if (name === "Pipeline Repo Assist" || name === "Frontend Agent") return "implementation";
  if (name === "Pipeline Review Agent") return "review";
  if (name === "Deploy to Vercel" || name === "Validate Deployment") return "deploy";
  // Infrastructure workflows that produce noise — suppress from build activity
  if (
    name === "Auto-Dispatch Pipeline Issues" ||
    name === "Auto-Dispatch Requeue" ||
    name === "Copilot Setup Steps" ||
    name === "CI Failure Router" ||
    name === "CI Failure Resolver" ||
    name === "CI Failure Doctor" ||
    name === "Deploy Router" ||
    name === "Agentics Maintenance" ||
    name === "Pipeline Watchdog"
  ) {
    return "noise";
  }
  return "pipeline";
}

function firstRepoId(payload) {
  const repo =
    payload.repositories?.[0] ||
    payload.repositories_added?.[0] ||
    null;
  return repo?.id || null;
}

function readHeader(value) {
  if (Array.isArray(value)) {
    return value[0] || "";
  }
  return typeof value === "string" ? value : "";
}

module.exports = { registerWebhookRoutes };
