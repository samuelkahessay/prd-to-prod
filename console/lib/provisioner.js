const { decrypt } = require("./crypto");

const TEMPLATE_OWNER = "samuelkahessay";
const TEMPLATE_REPO = "prd-to-prod-template";
const APP_INSTALL_URL = "https://github.com/apps/prd-to-prod-pipeline/installations/new";

function createProvisioner({ db, buildSessionStore, githubClient }) {
  async function provisionRepo(sessionId) {
    const session = buildSessionStore.getSession(sessionId);
    if (!session) throw new Error("Session not found");
    if (session.status !== "ready") throw new Error("Session is not ready");
    if (!session.user_id) throw new Error("Session has no user");
    if (!session.prd_final) throw new Error("Session has no finalized PRD");

    // Get the user's OAuth grant (temporary, consumed here)
    const grant = db
      .prepare(
        `SELECT * FROM oauth_grants
         WHERE user_id = ? AND consumed_at IS NULL AND expires_at > ?
         ORDER BY created_at DESC LIMIT 1`
      )
      .get(session.user_id, new Date().toISOString());

    if (!grant) {
      throw new Error("No valid OAuth grant. User must re-authenticate.");
    }

    const userToken = decrypt(grant.github_access_token);

    // Consume the grant immediately
    db.prepare(
      "UPDATE oauth_grants SET consumed_at = ? WHERE id = ?"
    ).run(new Date().toISOString(), grant.id);

    // Get user profile for repo owner
    const user = db
      .prepare("SELECT * FROM users WHERE id = ?")
      .get(session.user_id);

    const repoName = deriveRepoName(session.prd_final);

    emitEvent(sessionId, "provision", "repo_creating", {
      detail: `Creating ${user.github_login}/${repoName} from template`,
    });

    // 1. Create repo from template
    let repoData;
    try {
      repoData = await githubClient.createRepoFromTemplate(userToken, {
        templateOwner: TEMPLATE_OWNER,
        templateRepo: TEMPLATE_REPO,
        owner: user.github_login,
        name: repoName,
        isPrivate: false,
      });
    } catch (err) {
      emitEvent(sessionId, "provision", "repo_creating", {
        detail: `Failed to create repo: ${err.message}`,
        error: true,
      });
      throw err;
    }

    buildSessionStore.updateSession(sessionId, {
      github_repo: `${user.github_login}/${repoName}`,
      github_repo_id: repoData.id,
      github_repo_url: repoData.html_url,
    });

    emitEvent(sessionId, "provision", "repo_created", {
      repo: `${user.github_login}/${repoName}`,
      repoId: repoData.id,
      url: repoData.html_url,
    });

    // 2. Wait for repo availability
    await githubClient.waitForRepo(userToken, user.github_login, repoName);

    // 3. Create labels
    await githubClient.createLabel(userToken, user.github_login, repoName, {
      name: "pipeline",
      color: "0075ca",
      description: "Pipeline-managed issue",
    });
    await githubClient.createLabel(userToken, user.github_login, repoName, {
      name: "feature",
      color: "a2eeef",
      description: "New feature",
    });

    emitEvent(sessionId, "provision", "labels_set", {
      detail: "Created pipeline and feature labels",
    });

    // 4. Configure Actions permissions
    try {
      await githubClient.configureActionsPermissions(
        userToken, user.github_login, repoName
      );
      await githubClient.enableAutoMerge(
        userToken, user.github_login, repoName
      );
      emitEvent(sessionId, "provision", "permissions_set", {
        detail: "Actions write permissions and auto-merge enabled",
      });
    } catch (err) {
      emitEvent(sessionId, "provision", "permissions_set", {
        detail: `Permissions setup partial: ${err.message}`,
        warning: true,
      });
    }

    // 5. Check if App is already installed on this repo
    const appCheck = await githubClient.checkAppInstallation(
      user.github_login, repoName
    );

    if (appCheck.installed) {
      buildSessionStore.updateSession(sessionId, {
        app_installation_id: appCheck.installationId,
        status: "provisioning",
      });

      emitEvent(sessionId, "provision", "app_installed", {
        detail: "GitHub App already has access to this repo",
        installationId: appCheck.installationId,
      });

      // Continue to issue creation
      await createPrdIssue(sessionId, appCheck.installationId);
      return { sessionId, status: "provisioning", installRequired: false };
    }

    // App not installed — transition to awaiting_install
    buildSessionStore.updateSession(sessionId, {
      status: "awaiting_install",
    });

    emitEvent(sessionId, "provision", "app_install_required", {
      detail: "Waiting for GitHub App installation",
      installUrl: `${APP_INSTALL_URL}?target_id=${user.github_id}`,
    });

    return {
      sessionId,
      status: "awaiting_install",
      installRequired: true,
      installUrl: `${APP_INSTALL_URL}?target_id=${user.github_id}`,
    };
  }

  async function createPrdIssue(sessionId, installationId) {
    const session = buildSessionStore.getSession(sessionId);
    if (!session?.prd_final || !session.github_repo) return;

    const existingIssue = findExistingPrdIssue(sessionId);
    if (existingIssue) {
      return existingIssue;
    }

    const [owner, repo] = session.github_repo.split("/");
    const token = await githubClient.getInstallationToken(installationId);

    const title = extractPrdTitle(session.prd_final);
    const issue = await githubClient.createIssue(token, owner, repo, {
      title: `[Pipeline] ${title}`,
      body: session.prd_final,
      labels: ["pipeline", "feature"],
    });

    emitEvent(sessionId, "provision", "prd_issue_created", {
      issueNumber: issue.number,
      issueUrl: issue.html_url,
      detail: `Created issue #${issue.number}`,
    });

    return issue;
  }

  function findExistingPrdIssue(sessionId) {
    const existingEvent = buildSessionStore
      .getEvents(sessionId, { category: "provision" })
      .find((event) => event.kind === "prd_issue_created");

    if (!existingEvent) {
      return null;
    }

    return {
      number: existingEvent.data.issueNumber,
      html_url: existingEvent.data.issueUrl,
    };
  }

  function emitEvent(sessionId, category, kind, data) {
    buildSessionStore.appendEvent(sessionId, { category, kind, data });
  }

  return { provisionRepo, createPrdIssue };
}

function deriveRepoName(prdMarkdown) {
  const titleMatch = prdMarkdown.match(/^#\s+PRD:\s*(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : "my-project";
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50) || "my-project";
}

function extractPrdTitle(prdMarkdown) {
  const match = prdMarkdown.match(/^#\s+PRD:\s*(.+)$/m);
  return match ? match[1].trim() : "New Project";
}

module.exports = { createProvisioner };
