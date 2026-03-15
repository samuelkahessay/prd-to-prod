const { createProvisioner } = require("../lib/provisioner");

test("createPrdIssue is idempotent once the pipeline issue has been created", async () => {
  const buildSessionStore = {
    getSession: jest.fn().mockReturnValue({
      id: "build-1",
      prd_final: "# PRD: Customer portal\n\n## Problem\n\nSupport requests get lost\n",
      github_repo: "octocat/customer-portal",
    }),
    getEvents: jest
      .fn()
      .mockReturnValueOnce([])
      .mockReturnValueOnce([
        {
          id: 1,
          build_session_id: "build-1",
          category: "provision",
          kind: "prd_issue_created",
          data: {
            issueNumber: 17,
            issueUrl: "https://github.com/octocat/customer-portal/issues/17",
          },
          created_at: "2026-03-14T18:00:00.000Z",
        },
      ]),
    appendEvent: jest.fn(),
  };
  const githubClient = {
    getInstallationToken: jest.fn().mockResolvedValue("installation-token"),
    createIssue: jest.fn().mockResolvedValue({
      number: 17,
      html_url: "https://github.com/octocat/customer-portal/issues/17",
    }),
  };

  const provisioner = createProvisioner({
    db: {},
    buildSessionStore,
    githubClient,
  });

  await provisioner.createPrdIssue("build-1", 99);
  const result = await provisioner.createPrdIssue("build-1", 99);

  expect(githubClient.createIssue).toHaveBeenCalledTimes(1);
  expect(buildSessionStore.appendEvent).toHaveBeenCalledTimes(1);
  expect(result).toEqual({
    number: 17,
    html_url: "https://github.com/octocat/customer-portal/issues/17",
  });
});
