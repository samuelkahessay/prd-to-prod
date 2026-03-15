const BUILDER_OWNER = "samuelkahessay";
const BUILDER_REPO = "prd-to-prod-builder";
const BUILDER_WORKFLOW = "build-for-user.lock.yml";

function createBuildRunner({ buildSessionStore, githubClient }) {
  const platformToken = process.env.GH_AW_GITHUB_TOKEN;

  async function dispatchBuild(sessionId) {
    if (!platformToken) {
      throw new Error("GH_AW_GITHUB_TOKEN is required to dispatch builds");
    }

    const session = buildSessionStore.getSession(sessionId);
    if (!session) throw new Error("Session not found");
    if (!session.github_repo) throw new Error("Session has no repo");
    if (!session.app_installation_id) throw new Error("App not installed");
    if (session.status !== "provisioning") {
      throw new Error(`Session is not ready to build from status ${session.status}`);
    }

    try {
      await githubClient.dispatchWorkflow(
        platformToken,
        BUILDER_OWNER,
        BUILDER_REPO,
        BUILDER_WORKFLOW,
        {
          target_repo: session.github_repo,
          build_session_id: sessionId,
        }
      );
    } catch (error) {
      buildSessionStore.appendEvent(sessionId, {
        category: "build",
        kind: "dispatch_error",
        data: {
          agent: "build-for-user",
          detail: `Failed to dispatch builder workflow: ${error.message}`,
        },
      });
      throw error;
    }

    buildSessionStore.updateSession(sessionId, { status: "building" });

    buildSessionStore.appendEvent(sessionId, {
      category: "build",
      kind: "agent_started",
      data: {
        agent: "build-for-user",
        detail: `Dispatching builder agent for ${session.github_repo}`,
      },
    });

    buildSessionStore.appendEvent(sessionId, {
      category: "build",
      kind: "agent_progress",
      data: {
        agent: "build-for-user",
        detail: "Builder workflow dispatched — agents are starting up",
      },
    });
  }

  return { dispatchBuild };
}

module.exports = { createBuildRunner };
