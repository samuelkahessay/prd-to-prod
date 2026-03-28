import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import BuildPage from "@/app/build/page";
import BuildStatusPage from "@/app/build/[id]/page";
import { buildApi } from "@/lib/build-api";
import { navigateTo, replaceCurrentUrl } from "@/lib/browser-navigation";
import type {
  BuildEvent,
  BuildSession,
  BuildUser,
  LLMParsedResponse,
} from "@/lib/types";

jest.mock("@/lib/build-api", () => ({
  buildApi: {
    getMe: jest.fn(),
    createSession: jest.fn(),
    getSession: jest.fn(),
    sendMessage: jest.fn(),
    finalizeSession: jest.fn(),
    provisionRepo: jest.fn(),
    startBuild: jest.fn(),
    streamBuildEvents: jest.fn(),
    logout: jest.fn(),
  },
}));

jest.mock("@/lib/browser-navigation", () => ({
  navigateTo: jest.fn(),
  replaceCurrentUrl: jest.fn(),
}));

const mockedBuildApi = jest.mocked(buildApi);
const mockedNavigateTo = jest.mocked(navigateTo);
const mockedReplaceCurrentUrl = jest.mocked(replaceCurrentUrl);

beforeAll(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    value: jest.fn(() => null),
  });
});

function makeParsedResponse(status: "needs_input" | "ready"): LLMParsedResponse {
  return {
    status,
    message: status === "ready" ? "Ready to build." : "Need more detail.",
    question: status === "ready" ? null : "Who is this for?",
    prd:
      status === "ready"
        ? {
            title: "Customer portal",
            problem: "Support requests get lost",
            users: "Support teams",
            features: ["Ticket intake"],
            criteria: ["Users can submit a ticket"],
          }
        : null,
  };
}

function makeSession(status: BuildSession["status"] = "refining"): BuildSession {
  return {
    id: "session-1",
    user_id: null,
    status,
    github_repo: null,
    github_repo_id: null,
    github_repo_url: null,
    deploy_url: null,
    prd_final:
      status === "ready"
        ? "# PRD: Customer portal\n\n## Problem\n\nSupport requests get lost\n"
        : null,
    app_installation_id: null,
    is_demo: 0,
    created_at: "2026-03-14T17:00:00.000Z",
    updated_at: "2026-03-14T17:05:00.000Z",
  };
}

function makeAssistantEvent(parsed: LLMParsedResponse): BuildEvent {
  return {
    id: 1,
    build_session_id: "session-1",
    category: "chat",
    kind: "assistant_message",
    data: {
      role: "assistant",
      content: JSON.stringify(parsed),
      parsed,
    },
    created_at: "2026-03-14T17:05:00.000Z",
  };
}

function makeBuildEvent(partial: Partial<BuildEvent> & Pick<BuildEvent, "id" | "category" | "kind">): BuildEvent {
  return {
    build_session_id: "session-1",
    data: {},
    created_at: "2026-03-14T17:10:00.000Z",
    ...partial,
  };
}

beforeEach(() => {
  window.history.replaceState({}, "", "/build");
  mockedNavigateTo.mockReset();
  mockedBuildApi.getMe.mockReset();
  mockedBuildApi.createSession.mockReset();
  mockedBuildApi.getSession.mockReset();
  mockedBuildApi.sendMessage.mockReset();
  mockedBuildApi.finalizeSession.mockReset();
  mockedBuildApi.provisionRepo.mockReset();
  mockedBuildApi.startBuild.mockReset();
  mockedBuildApi.streamBuildEvents.mockReset();
  mockedBuildApi.logout.mockReset();
  mockedReplaceCurrentUrl.mockReset();
  mockedBuildApi.sendMessage.mockImplementation(async function* sendMessage() {});
  mockedBuildApi.streamBuildEvents.mockReturnValue(jest.fn());
});

describe("BuildPage", () => {

  it("rehydrates a ready session and preserves the auth return target", async () => {
    const parsed = makeParsedResponse("ready");

    mockedBuildApi.getMe.mockRejectedValue(new Error("Unauthorized"));
    mockedBuildApi.getSession.mockResolvedValue({
      session: makeSession("refining"),
      messages: [makeAssistantEvent(parsed)],
    });

    window.history.replaceState({}, "", "/build?session=session-1");

    render(<BuildPage />);

    expect(await screen.findByText("Ready to build.")).toBeInTheDocument();
    expect(await screen.findByText("PRD ready")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Sign in with GitHub to launch" })
    );

    expect(mockedNavigateTo).toHaveBeenCalledWith(
      "/pub/auth/github?return_to=%2Fbuild%3Fsession%3Dsession-1%26resume%3Dfinalize"
    );
  });

  it("auto-finalizes a restored ready session after OAuth and redirects to the status page", async () => {
    const user: BuildUser = {
      id: "user-1",
      githubId: 42,
      githubLogin: "octocat",
      githubAvatarUrl: "https://example.com/octocat.png",
    };
    const parsed = makeParsedResponse("ready");

    mockedBuildApi.getMe.mockResolvedValue(user);
    mockedBuildApi.getSession.mockResolvedValue({
      session: { ...makeSession("refining"), is_demo: 0 },
      messages: [makeAssistantEvent(parsed)],
    });
    mockedBuildApi.finalizeSession.mockResolvedValue({
      sessionId: "session-1",
      status: "ready",
      prd: parsed.prd,
    });

    window.history.replaceState(
      {},
      "",
      "/build?session=session-1&resume=finalize"
    );

    render(<BuildPage />);

    await waitFor(() => {
      expect(mockedBuildApi.finalizeSession).toHaveBeenCalledWith("session-1");
    });

    expect(mockedNavigateTo).toHaveBeenCalledWith("/build/session-1");
  });

  it("routes demo sessions to the dedicated demo surface after finalize", async () => {
    const user: BuildUser = {
      id: "user-1",
      githubId: 0,
      githubLogin: "demo-user",
      githubAvatarUrl: "",
    };
    const parsed = makeParsedResponse("ready");

    mockedBuildApi.getMe.mockResolvedValue(user);
    mockedBuildApi.getSession.mockResolvedValue({
      session: { ...makeSession("refining"), is_demo: 1 },
      messages: [makeAssistantEvent(parsed)],
    });
    mockedBuildApi.finalizeSession.mockResolvedValue({
      sessionId: "session-1",
      status: "ready",
      prd: parsed.prd,
    });

    window.history.replaceState(
      {},
      "",
      "/build?session=session-1&resume=finalize"
    );

    render(<BuildPage />);

    await waitFor(() => {
      expect(mockedBuildApi.finalizeSession).toHaveBeenCalledWith("session-1");
    });

    expect(mockedNavigateTo).toHaveBeenCalledWith("/demo/session-1");
  });

  it("preserves the recording preset when demo sessions finalize", async () => {
    const user: BuildUser = {
      id: "user-1",
      githubId: 0,
      githubLogin: "demo-user",
      githubAvatarUrl: "",
    };
    const parsed = makeParsedResponse("ready");

    mockedBuildApi.getMe.mockResolvedValue(user);
    mockedBuildApi.getSession.mockResolvedValue({
      session: { ...makeSession("refining"), is_demo: 1 },
      messages: [makeAssistantEvent(parsed)],
    });
    mockedBuildApi.finalizeSession.mockResolvedValue({
      sessionId: "session-1",
      status: "ready",
      prd: parsed.prd,
    });

    window.history.replaceState(
      {},
      "",
      "/demo?session=session-1&resume=finalize&preset=recording"
    );

    render(<BuildPage initialMode="demo" />);

    await waitFor(() => {
      expect(mockedBuildApi.finalizeSession).toHaveBeenCalledWith("session-1");
    });

    expect(mockedNavigateTo).toHaveBeenCalledWith(
      "/demo/session-1?preset=recording"
    );
  });

  it("preserves the e2e repo override across finalize redirects", async () => {
    const user: BuildUser = {
      id: "user-1",
      githubId: 42,
      githubLogin: "octocat",
      githubAvatarUrl: "https://example.com/octocat.png",
    };
    const parsed = makeParsedResponse("ready");

    mockedBuildApi.getMe.mockResolvedValue(user);
    mockedBuildApi.getSession.mockResolvedValue({
      session: { ...makeSession("refining"), is_demo: 0 },
      messages: [makeAssistantEvent(parsed)],
    });
    mockedBuildApi.finalizeSession.mockResolvedValue({
      sessionId: "session-1",
      status: "ready",
      prd: parsed.prd,
    });

    window.history.replaceState(
      {},
      "",
      "/build?session=session-1&resume=finalize&e2e_repo_name=personal-bookmark-manager-e2e-bc-abc12345"
    );

    render(<BuildPage />);

    await waitFor(() => {
      expect(mockedBuildApi.finalizeSession).toHaveBeenCalledWith("session-1");
    });

    expect(mockedNavigateTo).toHaveBeenCalledWith(
      "/build/session-1?e2e_repo_name=personal-bookmark-manager-e2e-bc-abc12345"
    );
  });

  it("uses /demo as the canonical public demo entry", async () => {
    mockedBuildApi.getMe.mockRejectedValue(new Error("Unauthorized"));
    mockedBuildApi.createSession.mockResolvedValue({ sessionId: "session-1" });

    window.history.replaceState({}, "", "/demo?preset=recording");

    render(<BuildPage initialMode="demo" />);

    await waitFor(() => {
      expect(mockedBuildApi.createSession).toHaveBeenCalledWith(true);
    });

    expect(mockedReplaceCurrentUrl).toHaveBeenLastCalledWith(
      "/demo?preset=recording&session=session-1"
    );
  });
});

describe("BuildStatusPage", () => {
  it("mounts the factory scene from hydrated events and applies only new streamed events", async () => {
    let streamListener: ((event: BuildEvent) => void) | null = null;
    const issueEvent = makeBuildEvent({
      id: 2,
      category: "provision",
      kind: "prd_issue_created",
      data: {
        issueNumber: 7,
        issueUrl: "https://github.com/octocat/customer-portal/issues/7",
        detail: "Created issue #7",
      },
    });

    mockedBuildApi.getSession.mockResolvedValue({
      session: { ...makeSession("building"), is_demo: 1 },
      messages: [makeAssistantEvent(makeParsedResponse("ready")), issueEvent],
    });
    mockedBuildApi.streamBuildEvents.mockImplementation((_sessionId, onEvent) => {
      streamListener = onEvent;
      return jest.fn();
    });

    render(await BuildStatusPage({ params: Promise.resolve({ id: "session-1" }) }));

    expect(
      await screen.findByRole("heading", { name: "Factory floor" })
    ).toBeInTheDocument();
    expect(screen.getByText(/Factory floor/)).toBeInTheDocument();
    expect(screen.getByText("1 issue")).toBeInTheDocument();
    expect(mockedBuildApi.streamBuildEvents).toHaveBeenCalledTimes(1);

    await act(async () => {
      streamListener?.(issueEvent);
    });

    expect(screen.getByText("1 issue")).toBeInTheDocument();

    await act(async () => {
      streamListener?.(
        makeBuildEvent({
          id: 3,
          category: "build",
          kind: "pr_opened",
          data: {
            agent: "repo-assist",
            pr_url: "https://github.com/octocat/customer-portal/pull/2",
            pr_title: "[Pipeline] Implement ticket intake",
            pr_count: 1,
          },
        })
      );
    });

    expect(await screen.findByText("1 PR")).toBeInTheDocument();
  });

  it("automatically provisions and starts the builder when the app is already installed", async () => {
    let streamListener: ((event: BuildEvent) => void) | null = null;

    mockedBuildApi.getSession.mockResolvedValue({
      session: { ...makeSession("ready"), is_demo: 1 },
      messages: [makeAssistantEvent(makeParsedResponse("ready"))],
    });
    mockedBuildApi.provisionRepo.mockResolvedValue({
      sessionId: "session-1",
      status: "ready_to_launch",
      installRequired: false,
    });
    mockedBuildApi.startBuild.mockResolvedValue({
      sessionId: "session-1",
      status: "building",
    });
    mockedBuildApi.streamBuildEvents.mockImplementation((_sessionId, onEvent) => {
      streamListener = onEvent;
      return jest.fn();
    });

    render(await BuildStatusPage({ params: Promise.resolve({ id: "session-1" }) }));

    await waitFor(() => {
      expect(mockedBuildApi.provisionRepo).toHaveBeenCalledWith("session-1");
    });
    await waitFor(() => {
      expect(mockedBuildApi.startBuild).toHaveBeenCalledWith("session-1");
    });

    expect(await screen.findByText("building")).toBeInTheDocument();

    await act(async () => {
      streamListener?.(
        makeBuildEvent({
          id: 9,
          category: "delivery",
          kind: "complete",
          data: {
            detail: "Deployment complete",
            deploy_url: "https://customer-portal.example.com",
          },
        })
      );
    });

    expect(
      await screen.findByText("That was a simulation. Ready for the invite-only beta?")
    ).toBeInTheDocument();
  });

  it("forwards an e2e repo override when auto-provisioning", async () => {
    mockedBuildApi.getSession.mockResolvedValue({
      session: { ...makeSession("ready"), is_demo: 1 },
      messages: [makeAssistantEvent(makeParsedResponse("ready"))],
    });
    mockedBuildApi.provisionRepo.mockResolvedValue({
      sessionId: "session-1",
      status: "ready_to_launch",
      installRequired: false,
    });
    mockedBuildApi.startBuild.mockResolvedValue({
      sessionId: "session-1",
      status: "building",
    });

    render(
      await BuildStatusPage({
        params: Promise.resolve({ id: "session-1" }),
        searchParams: Promise.resolve({
          e2e_repo_name: "personal-bookmark-manager-e2e-po-abc12345",
        }),
      })
    );

    await waitFor(() => {
      expect(mockedBuildApi.provisionRepo).toHaveBeenCalledWith("session-1", {
        repoName: "personal-bookmark-manager-e2e-po-abc12345",
      });
    });
  });

  it("shows the install CTA and lets the user continue after app installation", async () => {
    mockedBuildApi.getSession.mockResolvedValue({
      session: { ...makeSession("ready"), is_demo: 1 },
      messages: [makeAssistantEvent(makeParsedResponse("ready"))],
    });
    mockedBuildApi.provisionRepo
      .mockResolvedValueOnce({
        sessionId: "session-1",
        status: "awaiting_install",
        installRequired: true,
        installUrl: "https://github.com/apps/prd-to-prod/install",
      })
      .mockResolvedValueOnce({
        sessionId: "session-1",
        status: "ready_to_launch",
        installRequired: false,
      });
    mockedBuildApi.startBuild.mockResolvedValue({
      sessionId: "session-1",
      status: "building",
    });

    render(await BuildStatusPage({ params: Promise.resolve({ id: "session-1" }) }));

    expect(
      await screen.findByRole("link", { name: "Install GitHub App" })
    ).toHaveAttribute("href", "https://github.com/apps/prd-to-prod/install");

    fireEvent.click(
      screen.getByRole("button", { name: "I've installed it - continue" })
    );

    await waitFor(() => {
      expect(mockedBuildApi.provisionRepo).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(mockedBuildApi.startBuild).toHaveBeenCalledWith("session-1");
    });
  });

  it("shows repo handoff success when deployment is skipped", async () => {
    mockedBuildApi.getSession.mockResolvedValue({
      session: {
        ...makeSession("handoff_ready"),
        is_demo: 0,
        github_repo: "octocat/customer-portal",
        github_repo_url: "https://github.com/octocat/customer-portal",
      },
      messages: [
        makeAssistantEvent(makeParsedResponse("ready")),
        makeBuildEvent({
          id: 4,
          category: "delivery",
          kind: "deployment_skipped",
          data: {
            detail: "Deployment validation skipped because no deployment URL is configured for this beta run.",
          },
        }),
      ],
      gates: {
        codeRedeemed: true,
        credentialsSubmitted: true,
        deployConfigured: false,
      },
    });

    render(await BuildStatusPage({ params: Promise.resolve({ id: "session-1" }) }));

    expect(await screen.findByText("handoff_ready")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open repo" })).toHaveAttribute(
      "href",
      "https://github.com/octocat/customer-portal",
    );
    expect(
      screen.getByText(/Deployment was skipped\. Add Vercel credentials on a future run/i)
    ).toBeInTheDocument();
  });
});
