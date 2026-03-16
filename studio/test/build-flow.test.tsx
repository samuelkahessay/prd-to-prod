import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import BuildPage from "@/app/build/page";
import BuildStatusPage from "@/app/build/[id]/page";
import { buildApi } from "@/lib/build-api";
import { navigateTo } from "@/lib/browser-navigation";
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

    fireEvent.click(screen.getByRole("button", { name: "Sign in & build" }));

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
      session: makeSession("refining"),
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
      session: makeSession("building"),
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
      session: makeSession("ready"),
      messages: [makeAssistantEvent(makeParsedResponse("ready"))],
    });
    mockedBuildApi.provisionRepo.mockResolvedValue({
      sessionId: "session-1",
      status: "provisioning",
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
      await screen.findByRole("link", { name: "Open deployed app" })
    ).toHaveAttribute("href", "https://customer-portal.example.com");
  });

  it("shows the install CTA and lets the user continue after app installation", async () => {
    mockedBuildApi.getSession.mockResolvedValue({
      session: makeSession("ready"),
      messages: [makeAssistantEvent(makeParsedResponse("ready"))],
    });
    mockedBuildApi.provisionRepo.mockResolvedValue({
      sessionId: "session-1",
      status: "awaiting_install",
      installRequired: true,
      installUrl: "https://github.com/apps/prd-to-prod/install",
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
      expect(mockedBuildApi.startBuild).toHaveBeenCalledWith("session-1");
    });
  });
});
