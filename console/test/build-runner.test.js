const { createBuildRunner } = require("../lib/build-runner");

describe("createBuildRunner", () => {
  const originalToken = process.env.GH_AW_GITHUB_TOKEN;

  beforeEach(() => {
    process.env.GH_AW_GITHUB_TOKEN = "platform-token";
  });

  afterEach(() => {
    if (originalToken === undefined) {
      delete process.env.GH_AW_GITHUB_TOKEN;
    } else {
      process.env.GH_AW_GITHUB_TOKEN = originalToken;
    }
    jest.restoreAllMocks();
  });

  test("dispatchBuild leaves the session retryable when workflow dispatch fails", async () => {
    const buildSessionStore = {
      getSession: jest.fn().mockReturnValue({
        id: "build-1",
        status: "provisioning",
        github_repo: "octocat/customer-portal",
        app_installation_id: 99,
      }),
      updateSession: jest.fn(),
      appendEvent: jest.fn(),
    };
    const githubClient = {
      dispatchWorkflow: jest.fn().mockRejectedValue(new Error("workflow missing")),
    };

    const buildRunner = createBuildRunner({ buildSessionStore, githubClient });

    await expect(buildRunner.dispatchBuild("build-1")).rejects.toThrow(
      "workflow missing"
    );

    expect(buildSessionStore.updateSession).not.toHaveBeenCalled();
    expect(buildSessionStore.appendEvent).toHaveBeenCalledWith("build-1", {
      category: "build",
      kind: "dispatch_error",
      data: {
        agent: "build-for-user",
        detail: "Failed to dispatch builder workflow: workflow missing",
      },
    });
  });

  test("dispatchBuild marks the session building only after GitHub accepts the workflow", async () => {
    const buildSessionStore = {
      getSession: jest.fn().mockReturnValue({
        id: "build-1",
        status: "provisioning",
        github_repo: "octocat/customer-portal",
        app_installation_id: 99,
      }),
      updateSession: jest.fn(),
      appendEvent: jest.fn(),
    };
    const githubClient = {
      dispatchWorkflow: jest.fn().mockResolvedValue(undefined),
    };

    const buildRunner = createBuildRunner({ buildSessionStore, githubClient });

    await buildRunner.dispatchBuild("build-1");

    expect(githubClient.dispatchWorkflow).toHaveBeenCalledWith(
      "platform-token",
      "samuelkahessay",
      "prd-to-prod-builder",
      "build-for-user.lock.yml",
      {
        target_repo: "octocat/customer-portal",
        build_session_id: "build-1",
      }
    );
    expect(buildSessionStore.updateSession).toHaveBeenCalledWith("build-1", {
      status: "building",
    });
    expect(buildSessionStore.appendEvent).toHaveBeenNthCalledWith(1, "build-1", {
      category: "build",
      kind: "agent_started",
      data: {
        agent: "build-for-user",
        detail: "Dispatching builder agent for octocat/customer-portal",
      },
    });
  });
});
