import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import { E2EDashboard } from "@/components/console/e2e/dashboard";
import { E2ERunDetail } from "@/components/console/e2e/run-detail";
import { api } from "@/lib/api";
import type { E2ERun } from "@/lib/types";

jest.mock("@/lib/api", () => ({
  api: {
    startE2ERun: jest.fn(),
    listE2ERuns: jest.fn(),
    streamE2ERun: jest.fn(),
    getE2EReport: jest.fn(),
    cleanupE2ERun: jest.fn(),
  },
}));

const mockedApi = jest.mocked(api);

function makeRun(overrides: Partial<E2ERun> = {}): E2ERun {
  return {
    id: "run-1",
    lane: "provision-only",
    activeLane: "provision-only",
    status: "running",
    failureClass: null,
    failureDetail: "",
    buildSessionId: "session-1",
    repoFullName: "octocat/example",
    repoUrl: "https://github.com/octocat/example",
    rootIssueNumber: 1,
    rootIssueUrl: "",
    firstPrNumber: null,
    firstPrUrl: "",
    cleanupMode: "keep",
    cleanupStatus: "pending",
    cleanupDetail: "",
    keepRepo: true,
    cookieJarPath: "/tmp/.e2e-cookiejar",
    reportJsonPath: "",
    reportMarkdownPath: "",
    artifactRefs: [],
    metadata: {},
    startedAt: "2026-03-21T12:00:00.000Z",
    finishedAt: null,
    createdAt: "2026-03-21T12:00:00.000Z",
    updatedAt: "2026-03-21T12:00:00.000Z",
    events: [],
    ...overrides,
  };
}

beforeEach(() => {
  mockedApi.startE2ERun.mockReset();
  mockedApi.listE2ERuns.mockReset();
  mockedApi.streamE2ERun.mockReset();
  mockedApi.getE2EReport.mockReset();
  mockedApi.cleanupE2ERun.mockReset();
  mockedApi.streamE2ERun.mockReturnValue(jest.fn());
});

test("dashboard launches a lane and refreshes the run list", async () => {
  mockedApi.startE2ERun.mockResolvedValue({ runId: "run-2", run: makeRun({ id: "run-2" }) });
  mockedApi.listE2ERuns.mockResolvedValue([makeRun({ id: "run-2", status: "queued" })]);

  render(
    <E2EDashboard initialRuns={[]} defaultCookieJarPath="/tmp/.e2e-cookiejar" />
  );

  fireEvent.click(screen.getByRole("button", { name: "Start lane" }));

  await waitFor(() => {
    expect(mockedApi.startE2ERun).toHaveBeenCalledWith({
      lane: "provision-only",
      keepRepo: true,
      cookieJarPath: "/tmp/.e2e-cookiejar",
    });
  });

  expect(await screen.findByText(/Run run-2 started/i)).toBeInTheDocument();
});

test("dashboard can launch the public demo smoke lane", async () => {
  mockedApi.startE2ERun.mockResolvedValue({
    runId: "run-3",
    run: makeRun({ id: "run-3", lane: "demo-browser-canary" }),
  });
  mockedApi.listE2ERuns.mockResolvedValue([
    makeRun({ id: "run-3", lane: "demo-browser-canary", status: "queued" }),
  ]);

  render(
    <E2EDashboard initialRuns={[]} defaultCookieJarPath="/tmp/.e2e-cookiejar" />
  );

  fireEvent.change(screen.getByLabelText("Lane"), {
    target: { value: "demo-browser-canary" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Start lane" }));

  await waitFor(() => {
    expect(mockedApi.startE2ERun).toHaveBeenCalledWith({
      lane: "demo-browser-canary",
      keepRepo: true,
      cookieJarPath: "/tmp/.e2e-cookiejar",
    });
  });
});

test("detail view streams run updates and shows report content", async () => {
  let streamListener: ((event: unknown) => void) | null = null;
  mockedApi.streamE2ERun.mockImplementation((_id, onEvent) => {
    streamListener = onEvent;
    return jest.fn();
  });
  mockedApi.getE2EReport.mockResolvedValue({
    reportJsonPath: "/tmp/report.json",
    reportMarkdownPath: "/tmp/report.md",
    reportJson: null,
    reportMarkdown: "# refreshed report",
  });
  mockedApi.cleanupE2ERun.mockResolvedValue({
    run: makeRun({ cleanupStatus: "deleted", cleanupDetail: "Deleted octocat/example." }),
  });

  render(
    <E2ERunDetail
      initialRun={makeRun({
        reportMarkdownPath: "/tmp/report.md",
        events: [
          {
            id: 1,
            runId: "run-1",
            lane: "provision-only",
            step: "provision",
            status: "running",
            detail: "Provisioning repo.",
            evidence: {},
            elapsedMs: 1000,
            createdAt: "2026-03-21T12:01:00.000Z",
          },
        ],
      })}
      initialReportMarkdown="# initial report"
    />
  );

  expect(screen.getByText("# initial report")).toBeInTheDocument();

  await act(async () => {
    streamListener?.({
      run: makeRun({
        status: "failed",
        failureClass: "decomposer_timeout",
        failureDetail: "Timed out waiting for child issues.",
      }),
    });
  });

  expect(await screen.findByText(/decomposer_timeout/)).toBeInTheDocument();
  expect(await screen.findByText("# refreshed report")).toBeInTheDocument();
});
