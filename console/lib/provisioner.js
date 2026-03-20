const { decrypt } = require("./crypto");

const TEMPLATE_OWNER = process.env.PUBLIC_BETA_TEMPLATE_OWNER || "samuelkahessay";
const TEMPLATE_REPO = process.env.PUBLIC_BETA_TEMPLATE_REPO || "prd-to-prod-template";
const APP_INSTALL_URL = "https://github.com/apps/prd-to-prod-pipeline/installations/new";
const PUBLIC_BETA_CAPACITY = Number.parseInt(
  process.env.PUBLIC_BETA_MAX_ACTIVE_BUILDS || "2",
  10
);
const PIPELINE_BOT_LOGIN =
  process.env.PUBLIC_BETA_PIPELINE_BOT_LOGIN ||
  process.env.PIPELINE_BOT_LOGIN ||
  "prd-to-prod-pipeline";
const BETA_COPILOT_TOKEN =
  process.env.PUBLIC_BETA_COPILOT_GITHUB_TOKEN || process.env.COPILOT_GITHUB_TOKEN;
const PIPELINE_APP_ID = process.env.PIPELINE_APP_ID || "";
const PIPELINE_APP_PRIVATE_KEY = process.env.PIPELINE_APP_PRIVATE_KEY || "";

const REPO_BOOTSTRAP_LABELS = [
  ["pipeline", "0075ca", "Pipeline-managed issue"],
  ["feature", "a2eeef", "New feature"],
  ["test", "7057ff", "Test coverage"],
  ["infra", "fbca04", "Infrastructure"],
  ["docs", "0075ca", "Documentation"],
  ["bug", "d73a4a", "Bug fix"],
  ["automation", "e4e669", "Created by automation"],
  ["in-progress", "d93f0b", "Work in progress"],
  ["blocked", "b60205", "Blocked by dependency"],
  ["ready", "0e8a16", "Ready for implementation"],
  ["architecture-draft", "7057ff", "Architecture plan awaiting human review"],
  ["architecture-approved", "0e8a16", "Architecture plan approved for decomposition"],
  ["completed", "0e8a16", "Completed and merged"],
  ["report", "c5def5", "Status report"],
  ["bug-intake", "e4e669", "Filed via bug-report template"],
  ["agentic-workflows", "ededed", "Agentic workflow failure notification"],
  ["ci-failure", "C24E3F", "Tracks active CI repair incidents on pull requests"],
  ["ci-auth", "B60205", "CI failure requires human credentials or secret repair"],
  ["ci-rate-limit", "FBCA04", "CI failure appears transient due to provider rate limits"],
  ["ci-timeout", "D4C5F9", "CI failure appears transient due to job timeout"],
  ["ci-infrastructure", "5319E7", "CI failure appears transient due to infrastructure instability"],
  ["needs-human", "B60205", "Requires human intervention rather than automated repair"],
  ["repair-in-progress", "D97706", "Automated CI repair has been dispatched or is actively retrying"],
  ["repair-escalated", "B60205", "Automated CI repair exhausted retries and needs human attention"],
];

function createProvisioner({ db, buildSessionStore, githubClient }) {
  async function provisionRepo(sessionId) {
    const session = getProvisionableSession(sessionId);
    let repoContext = session.github_repo
      ? parseRepo(session.github_repo)
      : await createTargetRepo(sessionId, session);

    const appState = await ensureAppInstallation(sessionId, repoContext);
    if (!appState.installed) {
      return appState.response;
    }

    return finishBootstrap(sessionId, {
      owner: repoContext.owner,
      repo: repoContext.repo,
      installationId: appState.installationId,
    });
  }

  async function resumeAppBootstrap(sessionId, installationId) {
    const session = getProvisionableSession(sessionId);
    if (!session.github_repo) {
      throw new Error("Session has no provisioned repository yet.");
    }

    const repoContext = parseRepo(session.github_repo);
    buildSessionStore.updateSession(sessionId, {
      app_installation_id: installationId,
      status: "bootstrapping",
    });
    emitEvent(sessionId, "provision", "app_installed", {
      detail: "GitHub App installed. Resuming bootstrap.",
      installationId,
    });
    return finishBootstrap(sessionId, {
      owner: repoContext.owner,
      repo: repoContext.repo,
      installationId,
    });
  }

  async function launchPipeline(sessionId) {
    const session = buildSessionStore.getSession(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }
    if (!session.github_repo || !session.app_installation_id) {
      throw new Error("Repository bootstrap is incomplete");
    }
    if (!["ready_to_launch", "awaiting_capacity", "stalled"].includes(session.status)) {
      throw new Error(`Session is not launchable from status ${session.status}`);
    }

    const rootIssue = await createPrdIssue(sessionId, session.app_installation_id);
    const rootIssueNumber = Number(rootIssue.number);

    if (!hasAvailableCapacity(sessionId)) {
      buildSessionStore.updateSession(sessionId, { status: "awaiting_capacity" });
      emitEvent(sessionId, "build", "capacity_waitlisted", {
        detail: "Capacity is full. Retry launch when an active beta slot opens.",
        rootIssueNumber,
      });
      return {
        sessionId,
        status: "awaiting_capacity",
        rootIssueNumber,
      };
    }

    const [owner, repo] = session.github_repo.split("/");
    const token = await githubClient.getInstallationToken(session.app_installation_id);

    try {
      await githubClient.dispatchWorkflow(
        token,
        owner,
        repo,
        "prd-decomposer.lock.yml",
        { issue_number: String(rootIssueNumber) }
      );
    } catch (error) {
      buildSessionStore.updateSession(sessionId, { status: "stalled" });
      emitEvent(sessionId, "build", "pipeline_stalled", {
        stage: "decompose",
        detail: `Failed to dispatch prd-decomposer: ${error.message}`,
      });
      throw error;
    }

    buildSessionStore.updateSession(sessionId, { status: "building" });
    emitEvent(sessionId, "build", "pipeline_started", {
      detail: `Dispatched prd-decomposer for issue #${rootIssueNumber}`,
      workflow: "prd-decomposer.lock.yml",
      rootIssueNumber,
    });

    return {
      sessionId,
      status: "building",
      rootIssueNumber,
    };
  }

  async function createPrdIssue(sessionId, installationId) {
    const session = buildSessionStore.getSession(sessionId);
    if (!session?.prd_final || !session.github_repo) {
      throw new Error("Session is missing repository or PRD content");
    }

    const existingRef = buildSessionStore
      .getRefs(sessionId, { type: "issue", key: "root" })
      .at(-1);
    if (existingRef) {
      return {
        number: Number(existingRef.ref_value),
        html_url: existingRef.metadata?.issueUrl || "",
      };
    }

    const [owner, repo] = session.github_repo.split("/");
    const token = await githubClient.getInstallationToken(installationId);

    const title = extractPrdTitle(session.prd_final);
    const issue = await githubClient.createIssue(token, owner, repo, {
      title: `[Pipeline] ${title}`,
      body: session.prd_final,
      labels: [],
    });

    buildSessionStore.upsertRef(sessionId, {
      type: "issue",
      key: "root",
      value: String(issue.number),
      metadata: {
        issueUrl: issue.html_url,
        title: issue.title,
      },
    });

    emitEvent(sessionId, "provision", "prd_issue_created", {
      issueNumber: issue.number,
      issueUrl: issue.html_url,
      detail: `Created root PRD issue #${issue.number}`,
    });

    return issue;
  }

  async function createTargetRepo(sessionId, session) {
    const grant = getActiveOAuthGrant(session.user_id);
    if (!grant) {
      throw new Error("No valid OAuth grant. User must re-authenticate.");
    }

    const userToken = decrypt(grant.github_access_token);
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(session.user_id);
    const repoName = deriveRepoName(session.prd_final);

    emitEvent(sessionId, "provision", "repo_creating", {
      detail: `Creating ${user.github_login}/${repoName} from scaffold`,
    });

    let repoData;
    try {
      repoData = await githubClient.createRepoFromTemplate(userToken, {
        templateOwner: TEMPLATE_OWNER,
        templateRepo: TEMPLATE_REPO,
        owner: user.github_login,
        name: repoName,
        isPrivate: true,
      });
    } catch (error) {
      emitEvent(sessionId, "provision", "repo_creating", {
        detail: `Failed to create repo: ${error.message}`,
        error: true,
      });
      throw error;
    }

    buildSessionStore.updateSession(sessionId, {
      github_repo: `${user.github_login}/${repoName}`,
      github_repo_id: repoData.id,
      github_repo_url: repoData.html_url,
    });
    consumeGrant(grant.id);

    buildSessionStore.upsertRef(sessionId, {
      type: "repo",
      key: "target",
      value: String(repoData.id),
      metadata: {
        repo: `${user.github_login}/${repoName}`,
        url: repoData.html_url,
      },
    });

    emitEvent(sessionId, "provision", "repo_created", {
      repo: `${user.github_login}/${repoName}`,
      repoId: repoData.id,
      url: repoData.html_url,
    });

    await githubClient.waitForRepo(userToken, user.github_login, repoName);
    return { owner: user.github_login, repo: repoName };
  }

  async function ensureAppInstallation(sessionId, { owner, repo }) {
    const session = buildSessionStore.getSession(sessionId);
    if (session?.app_installation_id) {
      return {
        installed: true,
        installationId: session.app_installation_id,
      };
    }

    const appCheck = await githubClient.checkAppInstallation(owner, repo);
    if (appCheck.installed) {
      buildSessionStore.updateSession(sessionId, {
        app_installation_id: appCheck.installationId,
        status: "bootstrapping",
      });

      emitEvent(sessionId, "provision", "app_installed", {
        detail: "GitHub App already has access to this repo",
        installationId: appCheck.installationId,
      });

      return {
        installed: true,
        installationId: appCheck.installationId,
      };
    }

    buildSessionStore.updateSession(sessionId, {
      status: "awaiting_install",
    });

    emitEvent(sessionId, "provision", "app_install_required", {
      detail: "Waiting for GitHub App installation",
      installUrl: buildInstallUrl(readUserGithubId(db, session.user_id)),
    });

    return {
      installed: false,
      response: {
        sessionId,
        status: "awaiting_install",
        installRequired: true,
        installUrl: buildInstallUrl(readUserGithubId(db, session.user_id)),
      },
    };
  }

  function getByokCredential(sessionId, key) {
    const refs = buildSessionStore.getRefs(sessionId, { type: "credential", key });
    if (refs.length === 0) return null;
    return decrypt(refs[0].ref_value);
  }

  function resolveCopilotToken(sessionId, session) {
    if (session.is_demo) return BETA_COPILOT_TOKEN;
    return getByokCredential(sessionId, "COPILOT_GITHUB_TOKEN") || null;
  }

  function resolveVercelCredentials(sessionId, session) {
    if (session.is_demo) return {};
    const creds = {};
    for (const key of ["VERCEL_TOKEN", "VERCEL_ORG_ID", "VERCEL_PROJECT_ID"]) {
      const value = getByokCredential(sessionId, key);
      if (value) creds[key] = value;
    }
    return creds;
  }

  async function finishBootstrap(sessionId, { owner, repo, installationId }) {
    const session = buildSessionStore.getSession(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    buildSessionStore.updateSession(sessionId, {
      app_installation_id: installationId,
      status: "bootstrapping",
    });
    emitEvent(sessionId, "provision", "bootstrap_started", {
      detail: "Applying public beta bootstrap settings",
    });

    const token = await githubClient.getInstallationToken(installationId);

    try {
      for (const [name, color, description] of REPO_BOOTSTRAP_LABELS) {
        await githubClient.createLabel(token, owner, repo, { name, color, description });
      }

      await githubClient.configureActionsPermissions(token, owner, repo);
      await githubClient.enableAutoMerge(token, owner, repo);
      await githubClient.ensureRepoMemoryBranch(token, owner, repo);
      if (!PIPELINE_APP_ID || !PIPELINE_APP_PRIVATE_KEY) {
        throw new Error("PIPELINE_APP_ID and PIPELINE_APP_PRIVATE_KEY must be configured on the platform");
      }
      await githubClient.upsertActionsVariable(token, owner, repo, {
        name: "PIPELINE_APP_ID",
        value: PIPELINE_APP_ID,
      });
      await githubClient.upsertActionsVariable(token, owner, repo, {
        name: "PIPELINE_BOT_LOGIN",
        value: PIPELINE_BOT_LOGIN,
      });
      await githubClient.createOrUpdateActionsSecret(token, owner, repo, {
        name: "PIPELINE_APP_PRIVATE_KEY",
        value: PIPELINE_APP_PRIVATE_KEY,
      });

      // Resolve Copilot token: BYOK for real sessions, platform fallback for demo
      const copilotToken = resolveCopilotToken(sessionId, session);
      if (!copilotToken) {
        throw new Error(
          session.is_demo
            ? "COPILOT_GITHUB_TOKEN is not configured on the platform"
            : "Copilot token not provided. Submit credentials before provisioning."
        );
      }
      await githubClient.createOrUpdateActionsSecret(token, owner, repo, {
        name: "COPILOT_GITHUB_TOKEN",
        value: copilotToken,
      });

      // Write optional Vercel BYOK credentials if provided
      const vercelCreds = resolveVercelCredentials(sessionId, session);
      for (const [name, value] of Object.entries(vercelCreds)) {
        await githubClient.createOrUpdateActionsSecret(token, owner, repo, {
          name,
          value,
        });
      }

      const productionUrl = derivePublicBetaProductionUrl(repo);
      if (productionUrl) {
        await githubClient.upsertActionsVariable(token, owner, repo, {
          name: "VERCEL_PROJECT_PRODUCTION_URL",
          value: productionUrl,
        });
        buildSessionStore.updateSession(sessionId, { deploy_url: productionUrl });
        buildSessionStore.upsertRef(sessionId, {
          type: "vercel_project",
          key: "production_url",
          value: productionUrl,
          metadata: { source: "template" },
        });
      }

      try {
        await githubClient.ensureBranchProtection(token, owner, repo);
      } catch (warning) {
        emitEvent(sessionId, "provision", "bootstrap_warning", {
          detail: `Branch protection was not fully configured: ${warning.message}`,
        });
      }
    } catch (error) {
      buildSessionStore.updateSession(sessionId, { status: "stalled" });
      emitEvent(sessionId, "provision", "pipeline_stalled", {
        stage: "bootstrap",
        detail: `Bootstrap failed: ${error.message}`,
      });
      throw error;
    }

    buildSessionStore.updateSession(sessionId, { status: "ready_to_launch" });
    emitEvent(sessionId, "provision", "bootstrap_complete", {
      detail: "Public beta bootstrap complete. Ready to launch the pipeline.",
    });

    return {
      sessionId,
      status: "ready_to_launch",
      installRequired: false,
    };
  }

  function getProvisionableSession(sessionId) {
    const session = buildSessionStore.getSession(sessionId);
    if (!session) throw new Error("Session not found");
    if (!session.user_id) throw new Error("Session has no user");
    if (!session.prd_final) throw new Error("Session has no finalized PRD");

    const allowed = new Set([
      "ready",
      "awaiting_install",
      "bootstrapping",
      "ready_to_launch",
      "awaiting_capacity",
      "stalled",
    ]);
    if (!allowed.has(session.status)) {
      throw new Error(`Session is not provisionable from status ${session.status}`);
    }

    return session;
  }

  function hasAvailableCapacity(sessionId) {
    const active = db
      .prepare(
        `SELECT COUNT(*) AS total
         FROM build_sessions
         WHERE is_demo = 0 AND status = 'building'`
      )
      .get()?.total || 0;
    const session = buildSessionStore.getSession(sessionId);
    if (session?.status === "building") {
      return true;
    }
    return active < Math.max(1, PUBLIC_BETA_CAPACITY);
  }

  function getActiveOAuthGrant(userId) {
    return db
      .prepare(
        `SELECT * FROM oauth_grants
         WHERE user_id = ? AND consumed_at IS NULL AND expires_at > ?
         ORDER BY created_at DESC LIMIT 1`
      )
      .get(userId, new Date().toISOString());
  }

  function consumeGrant(grantId) {
    db.prepare(
      "UPDATE oauth_grants SET consumed_at = ? WHERE id = ?"
    ).run(new Date().toISOString(), grantId);
  }

  function emitEvent(sessionId, category, kind, data) {
    buildSessionStore.appendEvent(sessionId, { category, kind, data });
  }

  return {
    provisionRepo,
    resumeAppBootstrap,
    launchPipeline,
    createPrdIssue,
  };
}

function buildInstallUrl(githubId) {
  return `${APP_INSTALL_URL}${githubId ? `?target_id=${githubId}` : ""}`;
}

function deriveRepoName(prdMarkdown) {
  const titleMatch = prdMarkdown.match(/^#\s+PRD:\s*(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : "my-project";
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50) || "my-project"
  );
}

function derivePublicBetaProductionUrl(repoName) {
  const template = process.env.PUBLIC_BETA_VERCEL_PROJECT_PRODUCTION_URL_TEMPLATE;
  if (template) {
    return normalizeUrl(template.replaceAll("{repo}", repoName));
  }

  const domainSuffix = process.env.PUBLIC_BETA_VERCEL_DOMAIN_SUFFIX;
  if (domainSuffix) {
    return normalizeUrl(`https://${repoName}.${domainSuffix}`);
  }

  return null;
}

function normalizeUrl(value) {
  if (!value) {
    return null;
  }
  return /^https?:\/\//.test(value) ? value : `https://${value}`;
}

function extractPrdTitle(prdMarkdown) {
  const match = prdMarkdown.match(/^#\s+PRD:\s*(.+)$/m);
  return match ? match[1].trim() : "New Project";
}

function parseRepo(fullName) {
  const [owner, repo] = fullName.split("/");
  if (!owner || !repo) {
    throw new Error(`Invalid repository name: ${fullName}`);
  }
  return { owner, repo };
}

function readUserGithubId(db, userId) {
  if (!userId) {
    return null;
  }
  return db.prepare("SELECT github_id FROM users WHERE id = ?").get(userId)?.github_id || null;
}

module.exports = { createProvisioner, deriveRepoName };
