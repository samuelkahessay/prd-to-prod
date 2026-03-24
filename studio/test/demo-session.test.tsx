import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { DemoSession } from "@/components/demo/demo-session";
import { buildApi } from "@/lib/build-api";
import type { BuildEvent, BuildSession } from "@/lib/types";

let playbackHandler: ((event: BuildEvent) => void) | null = null;

jest.mock("@/lib/build-api", () => ({
  buildApi: {
    getSession: jest.fn(),
    provisionRepo: jest.fn(),
    startBuild: jest.fn(),
    streamBuildEvents: jest.fn(),
  },
}));

jest.mock("@/components/factory/factory-scene", () => ({
  FactoryScene: ({
    events,
    onPlaybackEvent,
  }: {
    events: BuildEvent[];
    onPlaybackEvent?: (event: BuildEvent) => void;
  }) => {
    playbackHandler = onPlaybackEvent ?? null;
    return <div data-testid="factory-scene">{events.length} events</div>;
  },
}));

jest.mock("@/components/shared/prd-to-prod-animation", () => ({
  PrdToProdAnimation: () => <div data-testid="prd-to-prod-animation" />,
}));

const mockedBuildApi = jest.mocked(buildApi);

function makeSession(status: BuildSession["status"] = "ready"): BuildSession {
  return {
    id: "session-1",
    user_id: "demo-user",
    status,
    github_repo: null,
    github_repo_id: null,
    github_repo_url: null,
    deploy_url: null,
    prd_final: "# PRD: Customer portal\n\nA demo PRD.",
    app_installation_id: null,
    is_demo: 1,
    created_at: "2026-03-24T17:00:00.000Z",
    updated_at: "2026-03-24T17:00:00.000Z",
  };
}

function makeEvent(
  partial: Partial<BuildEvent> & Pick<BuildEvent, "id" | "category" | "kind">
): BuildEvent {
  return {
    build_session_id: "session-1",
    data: {},
    created_at: "2026-03-24T17:10:00.000Z",
    ...partial,
  };
}

beforeEach(() => {
  jest.useFakeTimers();
  playbackHandler = null;
  mockedBuildApi.provisionRepo.mockReset();
  mockedBuildApi.startBuild.mockReset();
  mockedBuildApi.getSession.mockReset();
  mockedBuildApi.streamBuildEvents.mockReset();
  mockedBuildApi.getSession.mockResolvedValue({
    session: makeSession("ready"),
    messages: [],
  });
  mockedBuildApi.streamBuildEvents.mockReturnValue(jest.fn());
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

describe("DemoSession", () => {
  it("auto-starts the demo flow and reveals the proof endcap after terminal playback", async () => {
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
      <DemoSession
        initialEvents={[]}
        initialSession={makeSession("ready")}
        replayPreset="recording"
      />
    );

    await waitFor(() => {
      expect(mockedBuildApi.provisionRepo).toHaveBeenCalledWith("session-1");
    });
    await waitFor(() => {
      expect(mockedBuildApi.startBuild).toHaveBeenCalledWith("session-1");
    });

    expect(screen.getByText("Proof incoming")).toBeInTheDocument();

    act(() => {
      playbackHandler?.(
        makeEvent({
          id: 1,
          category: "provision",
          kind: "repo_created",
          data: {
            repo: "octocat/customer-portal",
            url: "https://github.com/octocat/customer-portal",
          },
        })
      );
      playbackHandler?.(
        makeEvent({
          id: 2,
          category: "provision",
          kind: "prd_issue_created",
          data: { issueNumber: 7 },
        })
      );
      playbackHandler?.(
        makeEvent({
          id: 3,
          category: "build",
          kind: "pr_opened",
          data: {
            pr_title: "[Pipeline] Implement ticket intake",
            pr_url: "https://github.com/octocat/customer-portal/pull/2",
            pr_count: 1,
          },
        })
      );
      playbackHandler?.(
        makeEvent({
          id: 4,
          category: "build",
          kind: "pr_merged",
          data: {
            detail: "PR #2 merged to main",
          },
        })
      );
      playbackHandler?.(
        makeEvent({
          id: 5,
          category: "build",
          kind: "ci_passed",
          data: {
            detail: "CI passed on main",
          },
        })
      );
      playbackHandler?.(
        makeEvent({
          id: 6,
          category: "delivery",
          kind: "complete",
          data: {
            deploy_url: "https://customer-portal.prd-to-prod.vercel.app",
          },
        })
      );
      jest.advanceTimersByTime(900);
    });

    expect((await screen.findAllByText("Build complete")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Repo provisioned").length).toBeGreaterThan(0);
    expect(screen.getAllByText("PR merged").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Checks green").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "octocat/customer-portal" })[0]).toHaveAttribute(
      "href",
      "https://github.com/octocat/customer-portal"
    );
    expect(
      screen.getAllByRole("link", { name: "customer-portal.prd-to-prod.vercel.app" })[0]
    ).toHaveAttribute("href", "https://customer-portal.prd-to-prod.vercel.app");
    expect(
      screen.getByText("Recording preset locks ambient timing for repeatable takes")
    ).toBeInTheDocument();
  });

  it("keeps repo handoff proof when deploy proof is absent", async () => {
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
      <DemoSession
        initialEvents={[]}
        initialSession={makeSession("ready")}
      />
    );

    await waitFor(() => {
      expect(mockedBuildApi.startBuild).toHaveBeenCalledWith("session-1");
    });

    act(() => {
      playbackHandler?.(
        makeEvent({
          id: 7,
          category: "provision",
          kind: "repo_created",
          data: {
            repo: "octocat/customer-portal",
            url: "https://github.com/octocat/customer-portal",
          },
        })
      );
      playbackHandler?.(
        makeEvent({
          id: 8,
          category: "delivery",
          kind: "handoff_ready",
          data: {
            detail: "Repository handoff is ready",
          },
        })
      );
      jest.advanceTimersByTime(900);
    });

    expect((await screen.findAllByText("Repo handoff")).length).toBeGreaterThan(0);
    expect(
      screen.getByText("Demo mode ends with repo proof even when deploy proof is absent.")
    ).toBeInTheDocument();
  });

  it("falls back to session polling when the live event stream is quiet", async () => {
    mockedBuildApi.provisionRepo.mockResolvedValue({
      sessionId: "session-1",
      status: "ready_to_launch",
      installRequired: false,
    });
    mockedBuildApi.startBuild.mockResolvedValue({
      sessionId: "session-1",
      status: "building",
    });
    mockedBuildApi.getSession.mockResolvedValue({
      session: {
        ...makeSession("complete"),
        github_repo: "octocat/customer-portal",
        github_repo_url: "https://github.com/octocat/customer-portal",
        deploy_url: "https://customer-portal.prd-to-prod.vercel.app",
      },
      messages: [
        makeEvent({
          id: 11,
          category: "provision",
          kind: "repo_created",
          data: {
            repo: "octocat/customer-portal",
            url: "https://github.com/octocat/customer-portal",
          },
        }),
        makeEvent({
          id: 12,
          category: "delivery",
          kind: "complete",
          data: {
            deploy_url: "https://customer-portal.prd-to-prod.vercel.app",
          },
        }),
      ],
    });

    render(
      <DemoSession
        initialEvents={[]}
        initialSession={makeSession("ready")}
      />
    );

    await waitFor(() => {
      expect(mockedBuildApi.getSession).toHaveBeenCalledWith("session-1");
    });

    act(() => {
      playbackHandler?.(
        makeEvent({
          id: 11,
          category: "provision",
          kind: "repo_created",
          data: {
            repo: "octocat/customer-portal",
            url: "https://github.com/octocat/customer-portal",
          },
        })
      );
      playbackHandler?.(
        makeEvent({
          id: 12,
          category: "delivery",
          kind: "complete",
          data: {
            deploy_url: "https://customer-portal.prd-to-prod.vercel.app",
          },
        })
      );
      jest.advanceTimersByTime(900);
    });

    expect((await screen.findAllByText("Build complete")).length).toBeGreaterThan(0);
  });
});
