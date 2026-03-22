const { execFile } = require("child_process");
const { promisify } = require("util");

const { createAccessCodeStore } = require("../access-codes");
const { classifyFailure } = require("./classifier");
const {
  DASHBOARD_LAUNCHABLE_LANES,
  E2E_LANES,
  FULL_LADDER_SEQUENCE,
  LANE_SLAS_MS,
  STANDARD_PRD_TEXT,
  resolveCookieJarPath,
} = require("./constants");
const {
  ensureBuildSessionCookie,
  loadCookieJar,
  saveCookieJar,
} = require("./cookie-jar");
const { createGitHubSnapshotCollector } = require("./github-snapshot");
const { createPublicBuildClient } = require("./public-client");
const { createE2EReportWriter } = require("./report-writer");
const { createE2EStore } = require("./store");

const execFileAsync = promisify(execFile);
const REQUIRED_BOOTSTRAP_LABELS = ["pipeline", "feature", "bug", "infra", "test", "docs"];
const REQUIRED_BOOTSTRAP_SECRETS = [
  "COPILOT_GITHUB_TOKEN",
  "PIPELINE_APP_PRIVATE_KEY",
  "GH_AW_GITHUB_TOKEN",
];
const REQUIRED_BOOTSTRAP_VARIABLES = {
  PIPELINE_ACTIVE: "true",
  PIPELINE_APP_ID: "required",
  PIPELINE_BOT_LOGIN: "required",
};
const TYPED_ISSUE_LABELS = new Set(["feature", "bug", "infra", "test", "docs"]);

function createE2EHarness({
  db,
  buildSessionStore,
  serviceResolver,
  projectRoot,
  baseUrl,
  studioUrl,
}) {
  const e2eStore = createE2EStore(db);
  const reportWriter = createE2EReportWriter({ projectRoot });
  const githubSnapshots = createGitHubSnapshotCollector({ serviceResolver });
  const accessCodes = createAccessCodeStore(db);
  const activeRuns = new Map();

  return {
    createRun(options = {}) {
      return createRunRecord(options);
    },

    getRun(id) {
      return e2eStore.getRun(id);
    },

    listRuns() {
      return e2eStore.listRuns();
    },

    async launchRun(options = {}) {
      const run = createRunRecord(options);
      void execute(run.id);
      return e2eStore.getRun(run.id);
    },

    async runNow(options = {}) {
      const run = createRunRecord(options);
      return execute(run.id);
    },

    async executeRun(runId) {
      return execute(runId);
    },

    async cleanupRun(runId, override = {}) {
      const run = e2eStore.getRun(runId);
      if (!run) {
        throw new Error("Run not found");
      }

      return cleanupTempRepo(run, {
        buildSessionStore,
        githubSnapshots,
        force: Boolean(override.force),
      });
    },

    async writeReport(runId, snapshot) {
      const run = e2eStore.getRun(runId);
      if (!run) {
        throw new Error("Run not found");
      }
      return persistReport(run, snapshot);
    },

    async validateAuth(cookieJarPath) {
      const jar = loadCookieJar(cookieJarPath || defaultCookieJarPath());
      if (!jar?.cookieHeader) {
        throw new Error("Missing cookie jar");
      }
      const client = createPublicBuildClient({
        baseUrl,
        cookieHeader: ensureBuildSessionCookie(jar.cookieHeader),
      });
      const user = await client.getMe();
      return { user, cookieJarPath: jar.path || cookieJarPath || defaultCookieJarPath() };
    },

    exportAuthCookie({ cookieJarPath, cookieHeader, user }) {
      const targetPath = cookieJarPath || defaultCookieJarPath();
      const normalized = ensureBuildSessionCookie(cookieHeader);
      saveCookieJar(targetPath, {
        baseUrl,
        studioUrl,
        cookieHeader: normalized,
        capturedAt: new Date().toISOString(),
        user: user || null,
        path: targetPath,
      });
      return {
        cookieJarPath: targetPath,
      };
    },

    authBootstrapUrl(cookieJarPath) {
      const targetPath = encodeURIComponent(cookieJarPath || defaultCookieJarPath());
      return `${stripTrailingSlash(studioUrl)}/console/e2e/auth?jar=${targetPath}`;
    },

    isDashboardLaunchable(lane) {
      return DASHBOARD_LAUNCHABLE_LANES.includes(lane);
    },
  };

  function createRunRecord(options) {
    const lane = options.lane || "provision-only";
    if (!E2E_LANES.includes(lane)) {
      throw new Error(`Unsupported E2E lane: ${lane}`);
    }

    return e2eStore.createRun({
      lane,
      activeLane: lane === "full-ladder" ? FULL_LADDER_SEQUENCE[0] : lane,
      status: "queued",
      cleanupMode: options.keepRepo ? "keep" : "auto",
      keepRepo: Boolean(options.keepRepo),
      cookieJarPath: options.cookieJarPath || defaultCookieJarPath(),
      metadata: {
        requestedBy: options.requestedBy || "system",
        lanes: [],
        browser: options.browser || {},
      },
    });
  }

  async function execute(runId) {
    if (activeRuns.has(runId)) {
      return activeRuns.get(runId);
    }

    const promise = (async () => {
      let run = e2eStore.getRun(runId);
      if (!run) {
        throw new Error("Run not found");
      }

      const startedAt = new Date().toISOString();
      run = e2eStore.updateRun(runId, {
        status: "running",
        started_at: startedAt,
      });
      appendStep(runId, run.activeLane || run.lane, "run.start", "passed", "E2E run accepted.");

      let snapshot = baseSnapshot();
      let lastContext = null;

      try {
        await runPreflightGate(runId, run.lane);
        const auth = await validateHarnessAuth(runId, run.cookieJarPath);

        if (run.lane === "full-ladder") {
          for (const lane of FULL_LADDER_SEQUENCE) {
            run = e2eStore.updateRun(runId, {
              active_lane: lane,
            });
            const laneResult = await executeLane(runId, lane, auth);
            lastContext = laneResult;
            mergeLaneMetadata(runId, laneResult);

            if (!laneResult.passed) {
              snapshot = await finalizeFailure(runId, laneResult);
              return e2eStore.getRun(runId);
            }

            if (!run.keepRepo) {
              await cleanupAfterLane(runId, laneResult);
            }
          }

          snapshot = await buildSnapshot(lastContext, {
            summary: "Full ladder completed across provision, decomposition, first PR, and browser canary stages.",
          });
        } else {
          const laneResult = await executeLane(runId, run.lane, auth);
          lastContext = laneResult;
          mergeLaneMetadata(runId, laneResult);

          if (!laneResult.passed) {
            snapshot = await finalizeFailure(runId, laneResult);
            return e2eStore.getRun(runId);
          }

          if (!run.keepRepo) {
            await cleanupAfterLane(runId, laneResult);
          }

          snapshot = await buildSnapshot(laneResult, {
            summary: `${laneResult.lane} passed.`,
          });
        }

        run = e2eStore.updateRun(runId, {
          status: "passed",
          failure_class: "",
          failure_detail: "",
          finished_at: new Date().toISOString(),
        });
        const report = persistReport(run, snapshot);
        run = e2eStore.updateRun(runId, {
          report_json_path: report.reportJsonPath,
          report_markdown_path: report.reportMarkdownPath,
          artifact_refs: report.artifactRefs,
        });
        appendStep(
          runId,
          run.activeLane || run.lane,
          "run.complete",
          "passed",
          "The E2E run completed successfully.",
          { reportJsonPath: report.reportJsonPath, reportMarkdownPath: report.reportMarkdownPath }
        );
        return e2eStore.getRun(runId);
      } catch (error) {
        const failure = classifyFailure({
          lane: run.lane,
          activeLane: run.activeLane,
          detail: error.message,
        });
        run = e2eStore.updateRun(runId, {
          status: error.failureClass === "auth_required" ? "auth_required" : "failed",
          failure_class: error.failureClass || failure.failureClass,
          failure_detail: error.failureDetail || failure.failureDetail,
          finished_at: new Date().toISOString(),
        });
        appendStep(
          runId,
          run.activeLane || run.lane,
          "run.error",
          "failed",
          error.failureDetail || failure.failureDetail
        );
        snapshot = await buildSnapshot(lastContext, {
          summary: error.failureDetail || failure.failureDetail,
          errors: [error.stack || error.message],
        });
        const report = persistReport(run, snapshot);
        e2eStore.updateRun(runId, {
          report_json_path: report.reportJsonPath,
          report_markdown_path: report.reportMarkdownPath,
          artifact_refs: report.artifactRefs,
        });
        return e2eStore.getRun(runId);
      } finally {
        activeRuns.delete(runId);
      }
    })();

    activeRuns.set(runId, promise);
    return promise;
  }

  async function executeLane(runId, lane, auth) {
    if (lane === "browser-canary") {
      return runBrowserCanaryLane(runId, lane, auth);
    }

    const provisionContext = await provisionFreshSession(runId, lane, auth);
    if (provisionContext?.passed === false) {
      return provisionContext;
    }
    if (lane === "provision-only") {
      const passed = verifyProvisionSnapshot(provisionContext.githubSnapshot);
      if (!passed.ok) {
        return failLaneResult(lane, provisionContext, {
          detail: passed.detail,
          timedOut: false,
        });
      }

      return {
        ...provisionContext,
        lane,
        passed: true,
        failure: null,
      };
    }

    const buildContext = await startBuildAndMonitor(runId, lane, provisionContext, auth.client);
    if (buildContext?.passed === false) {
      return buildContext;
    }
    if (lane === "decomposer-only") {
      const passed = verifyDecomposerSnapshot(buildContext.githubSnapshot, buildContext.rootIssueNumber);
      if (!passed.ok) {
        return failLaneResult(lane, buildContext, {
          detail: passed.detail,
        });
      }

      return {
        ...buildContext,
        lane,
        passed: true,
        failure: null,
      };
    }

    const prContext = await waitForFirstPr(runId, buildContext, auth.client);
    if (prContext?.passed === false) {
      return prContext;
    }
    const passed = verifyFirstPrSnapshot(prContext.githubSnapshot, prContext.firstPrNumber);
    if (!passed.ok) {
      return failLaneResult(lane, prContext, { detail: passed.detail });
    }

    return {
      ...prContext,
      lane,
      passed: true,
      failure: null,
    };
  }

  async function provisionFreshSession(runId, lane, auth) {
    const credentials = resolveCredentials();
    const client = auth.client;
    appendStep(runId, lane, "session.create", "running", "Creating build session.");
    const created = await client.createSession();
    const sessionId = created.sessionId;
    e2eStore.updateRun(runId, {
      build_session_id: sessionId,
      active_lane: lane,
    });
    appendStep(runId, lane, "session.create", "passed", `Created build session ${sessionId}.`);

    appendStep(runId, lane, "prd.submit", "running", "Submitting the standard bookmark-manager PRD.");
    const parsed = await client.sendMessage(sessionId, STANDARD_PRD_TEXT);
    if (!parsed || parsed.status !== "ready") {
      throw new Error("The standard PRD did not reach a ready state.");
    }
    await client.finalizeSession(sessionId);
    appendStep(runId, lane, "prd.submit", "passed", "Finalized the standard PRD.");

    const accessCode = accessCodes.generate({
      issuer: "e2e-harness",
      memo: `lane=${lane};run=${runId}`,
    })[0];
    appendStep(runId, lane, "access-code", "running", "Redeeming a fresh access code.");
    await client.redeemCode(sessionId, accessCode);
    appendStep(runId, lane, "access-code", "passed", "Redeemed a fresh access code.");

    appendStep(runId, lane, "credentials", "running", "Submitting BYOK credentials.");
    await client.submitCredentials(sessionId, credentials);
    appendStep(runId, lane, "credentials", "passed", "Stored Copilot and optional Vercel credentials.");

    appendStep(runId, lane, "provision", "running", "Provisioning the repository.");
    await client.provisionRepo(sessionId);

    const waited = await waitForProvision(runId, lane, sessionId, client);
    const githubSnapshot = await githubSnapshots.collect(waited.session);
    const repoInfo = githubSnapshot.repo || {};
    e2eStore.updateRun(runId, {
      repo_full_name: waited.session.github_repo || "",
      repo_url: waited.session.github_repo_url || repoInfo.htmlUrl || "",
    });

    appendStep(
      runId,
      lane,
      "provision",
      waited.session.status === "ready_to_launch" ? "passed" : "failed",
      waited.session.status === "ready_to_launch"
        ? `Provisioned ${waited.session.github_repo}.`
        : `Provisioning stopped at ${waited.session.status}.`
    );

    if (waited.session.status !== "ready_to_launch") {
      return failLaneResult(lane, {
        ...waited,
        client,
        githubSnapshot,
      }, {
        detail: `Provisioning stopped at ${waited.session.status}.`,
        timedOut: waited.timedOut,
      });
    }

    return {
      lane,
      client,
      sessionId,
      session: waited.session,
      buildEvents: waited.buildEvents,
      warnings: waited.warnings,
      githubSnapshot,
      repoCreatedWithinSla: waited.repoCreatedWithinSla,
      passed: true,
    };
  }

  async function startBuildAndMonitor(runId, lane, context, client) {
    appendStep(runId, lane, "build.start", "running", "Starting the build.");
    const result = await client.startBuild(context.sessionId);
    if (result.rootIssueNumber) {
      e2eStore.updateRun(runId, {
        root_issue_number: result.rootIssueNumber,
      });
    }
    appendStep(runId, lane, "build.start", "passed", "Build dispatch requested.");

    const pipelineStart = await waitForBuildEvent({
      client,
      sessionId: context.sessionId,
      timeoutMs: LANE_SLAS_MS["decomposer-only"].pipelineStarted,
      predicate(event) {
        return event.kind === "pipeline_started";
      },
    }).catch(async (error) =>
      failLaneResult(lane, context, {
        detail: error.message,
        timedOut: true,
        buildEvents: error.buildEvents,
      })
    );

    if (pipelineStart?.passed === false) {
      return pipelineStart;
    }

    if (pipelineStart?.event?.data?.rootIssueNumber) {
      e2eStore.updateRun(runId, {
        root_issue_number: pipelineStart.event.data.rootIssueNumber,
      });
    }
    appendStep(runId, lane, "pipeline.started", "passed", "Observed pipeline_started.");

    const childIssue = await waitForBuildEvent({
      client,
      sessionId: context.sessionId,
      timeoutMs: LANE_SLAS_MS["decomposer-only"].firstChildIssue,
      predicate(event) {
        return event.kind === "child_issue_tracked";
      },
    }).catch(async (error) =>
      failLaneResult(lane, context, {
        detail: error.message,
        timedOut: true,
        buildEvents: error.buildEvents,
      })
    );

    if (childIssue?.passed === false) {
      return childIssue;
    }

    const latestSession = (await client.getSession(context.sessionId)).session;
    const githubSnapshot = await githubSnapshots.collect(latestSession);
    const matchedChildIssue = childIssue.event?.data?.issueNumber || null;
    appendStep(runId, lane, "child-issue", "passed", "Observed the first child issue.");

    return {
      ...context,
      session: latestSession,
      buildEvents: childIssue.buildEvents,
      githubSnapshot,
      rootIssueNumber:
        pipelineStart.event?.data?.rootIssueNumber ||
        context.rootIssueNumber ||
        null,
      childIssueNumber: matchedChildIssue,
      passed: true,
    };
  }

  async function waitForFirstPr(runId, context, client) {
    const firstPr = await waitForBuildEvent({
      client,
      sessionId: context.sessionId,
      timeoutMs: LANE_SLAS_MS["first-pr"].firstPrOpened,
      predicate(event) {
        return event.kind === "first_pr_opened";
      },
      fallback: async () => {
        const latestSession = (await client.getSession(context.sessionId)).session;
        const githubSnapshot = await githubSnapshots.collect(latestSession);
        const firstPrMatch = githubSnapshot.pullRequests[0];
        if (firstPrMatch) {
          return {
            event: {
              kind: "first_pr_opened",
              data: {
                prNumber: firstPrMatch.number,
                prUrl: firstPrMatch.html_url,
              },
            },
            buildEvents: context.buildEvents,
            session: latestSession,
          };
        }
        return null;
      },
    }).catch(async (error) =>
      failLaneResult("first-pr", context, {
        detail: error.message,
        timedOut: true,
        buildEvents: error.buildEvents,
      })
    );

    if (firstPr?.passed === false) {
      return firstPr;
    }

    const latestSession = firstPr.session || (await client.getSession(context.sessionId)).session;
    const githubSnapshot = await githubSnapshots.collect(latestSession);
    const firstPrNumber = firstPr.event?.data?.prNumber || githubSnapshot.pullRequests[0]?.number || null;
    e2eStore.updateRun(runId, {
      first_pr_number: firstPrNumber,
      first_pr_url:
        firstPr.event?.data?.prUrl || githubSnapshot.pullRequests[0]?.html_url || "",
    });
    appendStep(runId, "first-pr", "first-pr", "passed", "Observed the first pull request.");

    return {
      ...context,
      session: latestSession,
      buildEvents: firstPr.buildEvents || context.buildEvents,
      githubSnapshot,
      firstPrNumber,
      passed: true,
    };
  }

  async function runBrowserCanaryLane(runId, lane, auth) {
    appendStep(runId, lane, "browser.launch", "running", "Launching browser canary.");

    let playwright;
    try {
      playwright = require("playwright");
    } catch {
      return failLaneResult(lane, null, {
        detail: "The browser-canary lane requires the `playwright` package on the local machine.",
        uiFlowFailed: true,
      });
    }

    const credentials = resolveCredentials();
    const accessCode = accessCodes.generate({
      issuer: "e2e-harness",
      memo: `lane=${lane};run=${runId}`,
    })[0];
    const browser = await playwright.chromium.launch({
      headless: process.env.E2E_HEADLESS !== "false",
    });

    try {
      const context = await browser.newContext();
      const studio = new URL(studioUrl);
      const buildSessionCookie = parseCookieValue(auth.cookieHeader, "build_session");
      if (!buildSessionCookie) {
        return failLaneResult(lane, null, {
          detail: "The exported cookie jar does not include build_session.",
          uiAuthFailed: true,
        });
      }

      await context.addCookies([
        {
          name: "build_session",
          value: buildSessionCookie,
          domain: studio.hostname,
          path: "/",
          httpOnly: true,
          secure: studio.protocol === "https:",
          sameSite: "Lax",
        },
      ]);

      const page = await context.newPage();
      await page.goto(`${stripTrailingSlash(studioUrl)}/build`, {
        waitUntil: "networkidle",
      });

      if (/github\.com\/login/.test(page.url())) {
        return failLaneResult(lane, null, {
          detail: "Playwright landed on GitHub login instead of the build flow.",
          uiAuthFailed: true,
        });
      }

      await page.getByRole("textbox").fill(STANDARD_PRD_TEXT);
      await page.getByRole("button", { name: "Send" }).click();
      await page.getByRole("button", { name: /Build it|Sign in & build/i }).waitFor({
        timeout: 60_000,
      });
      await page.getByRole("button", { name: /Build it|Sign in & build/i }).click();

      await page.waitForURL(/\/build\/[A-Za-z0-9-]+/, { timeout: 60_000 });
      const sessionId = page.url().split("/build/")[1]?.split("?")[0];
      if (!sessionId) {
        return failLaneResult(lane, null, {
          detail: "Browser canary did not reach a build-session status page.",
          uiFlowFailed: true,
        });
      }

      e2eStore.updateRun(runId, {
        build_session_id: sessionId,
      });
      appendStep(runId, lane, "browser.launch", "passed", `Browser canary reached session ${sessionId}.`);

      await page.getByPlaceholder("BETA-XXXXXXXX").fill(accessCode);
      await page.getByRole("button", { name: "Redeem" }).click();
      await page.getByPlaceholder("github_pat_...").fill(credentials.COPILOT_GITHUB_TOKEN);
      await page.getByRole("button", { name: "Continue" }).click();

      const client = auth.client;
      const pipelineStart = await waitForBuildEvent({
        client,
        sessionId,
        timeoutMs: LANE_SLAS_MS["decomposer-only"].pipelineStarted,
        predicate(event) {
          return event.kind === "pipeline_started";
        },
      }).catch(async (error) =>
        failLaneResult(lane, { sessionId }, {
          detail: error.message,
          timedOut: true,
          buildEvents: error.buildEvents,
        })
      );

      if (pipelineStart?.passed === false) {
        return pipelineStart;
      }

      const session = (await client.getSession(sessionId)).session;
      const githubSnapshot = await githubSnapshots.collect(session);
      return {
        lane,
        sessionId,
        session,
        client,
        buildEvents: pipelineStart.buildEvents,
        githubSnapshot,
        rootIssueNumber: pipelineStart.event?.data?.rootIssueNumber || null,
        passed: true,
      };
    } finally {
      await browser.close();
    }
  }

  async function waitForProvision(runId, lane, sessionId, client) {
    const started = Date.now();
    let repoSeenAt = null;
    let warnings = [];
    let lastEvents = [];
    let timedOut = false;

    while (Date.now() - started < LANE_SLAS_MS["provision-only"].bootstrapReady) {
      const data = await client.getSession(sessionId);
      const session = data.session;
      const buildEvents = data.messages.filter((event) => event.category !== "chat");
      lastEvents = buildEvents;

      if (!repoSeenAt && session.github_repo) {
        repoSeenAt = Date.now();
        appendStep(runId, lane, "repo.created", "passed", `Repo ${session.github_repo} created.`);
      }

      warnings = collectWarnings(buildEvents);
      const stalled = buildEvents.find((event) =>
        event.kind === "pipeline_stalled" ||
        event.kind === "capacity_waitlisted" ||
        event.kind === "provider_retry_exhausted"
      );

      if (stalled) {
        return {
          session,
          buildEvents,
          warnings,
          repoCreatedWithinSla:
            repoSeenAt == null
              ? false
              : repoSeenAt - started <= LANE_SLAS_MS["provision-only"].repoCreated,
          timedOut: false,
        };
      }

      if (session.status === "ready_to_launch") {
        return {
          session,
          buildEvents,
          warnings,
          repoCreatedWithinSla:
            repoSeenAt == null
              ? false
              : repoSeenAt - started <= LANE_SLAS_MS["provision-only"].repoCreated,
          timedOut: false,
        };
      }

      await delay(2_000);
    }

    timedOut = true;
    const finalData = await client.getSession(sessionId);
    return {
      session: finalData.session,
      buildEvents: finalData.messages.filter((event) => event.category !== "chat"),
      warnings,
      repoCreatedWithinSla:
        repoSeenAt == null
          ? false
          : repoSeenAt - started <= LANE_SLAS_MS["provision-only"].repoCreated,
      timedOut,
    };
  }

  async function waitForBuildEvent({
    client,
    sessionId,
    timeoutMs,
    predicate,
    fallback = null,
  }) {
    const initial = await client.getSession(sessionId);
    const initialEvents = initial.messages.filter((event) => event.category !== "chat");
    const matched = initialEvents.find((event) => predicate(event, initialEvents));
    if (matched) {
      return { event: matched, buildEvents: initialEvents, session: initial.session };
    }

    const failureKinds = new Set(["pipeline_stalled", "provider_retry_exhausted", "capacity_waitlisted"]);
    const controller = new AbortController();
    const buildEvents = [...initialEvents];
    const seenIds = new Set(buildEvents.map((event) => event.id));

    return new Promise((resolve, reject) => {
      const timer = setTimeout(async () => {
        controller.abort();
        if (typeof fallback === "function") {
          try {
            const resolved = await fallback();
            if (resolved) {
              resolve(resolved);
              return;
            }
          } catch {
            // ignore fallback failures
          }
        }

        const latest = await client.getSession(sessionId);
        const error = new Error("Timed out waiting for build milestone.");
        error.buildEvents = latest.messages.filter((event) => event.category !== "chat");
        reject(error);
      }, timeoutMs);

      client
        .streamBuildEvents(sessionId, {
          afterId: buildEvents.at(-1)?.id || 0,
          signal: controller.signal,
          onEvent(event) {
            if (seenIds.has(event.id)) {
              return;
            }
            seenIds.add(event.id);
            buildEvents.push(event);

            if (predicate(event, buildEvents)) {
              clearTimeout(timer);
              controller.abort();
              resolve({ event, buildEvents });
              return;
            }

            if (failureKinds.has(event.kind)) {
              clearTimeout(timer);
              controller.abort();
              const error = new Error(event.data?.detail || `Build emitted ${event.kind}.`);
              error.buildEvents = buildEvents;
              reject(error);
            }
          },
        })
        .catch((error) => {
          if (controller.signal.aborted) {
            return;
          }
          clearTimeout(timer);
          error.buildEvents = buildEvents;
          reject(error);
        });
    });
  }

  async function validateHarnessAuth(runId, cookieJarPath) {
    appendStep(runId, e2eStore.getRun(runId)?.activeLane || "auth", "auth.validate", "running", "Validating saved browser auth.");
    const jar = loadCookieJar(cookieJarPath || defaultCookieJarPath());
    if (!jar?.cookieHeader) {
      const error = new Error("No saved browser auth cookie was found. Run `scripts/e2e/harness.sh auth-refresh` first.");
      error.failureClass = "auth_required";
      error.failureDetail = error.message;
      throw error;
    }

    const cookieHeader = ensureBuildSessionCookie(jar.cookieHeader);
    const client = createPublicBuildClient({ baseUrl, cookieHeader });
    try {
      const user = await client.getMe();
      appendStep(runId, e2eStore.getRun(runId)?.activeLane || "auth", "auth.validate", "passed", `Authenticated as ${user.githubLogin}.`);
      return {
        client,
        cookieHeader,
        user,
      };
    } catch (error) {
      const authError = new Error("Saved browser auth expired. Refresh the cookie jar.");
      authError.failureClass = "auth_required";
      authError.failureDetail = authError.message;
      throw authError;
    }
  }

  async function runPreflightGate(runId, lane) {
    appendStep(runId, lane, "pre-e2e-gate", "running", "Running scripts/pre-e2e-gate.sh.");
    try {
      await execFileAsync("bash", ["scripts/pre-e2e-gate.sh", "--remote-harness"], {
        cwd: projectRoot,
        timeout: 10 * 60_000,
        env: process.env,
      });
      appendStep(runId, lane, "pre-e2e-gate", "passed", "scripts/pre-e2e-gate.sh passed.");
    } catch (error) {
      const detail = [
        "scripts/pre-e2e-gate.sh failed.",
        error.stderr || "",
        error.stdout || "",
      ]
        .filter(Boolean)
        .join("\n")
        .trim();
      appendStep(runId, lane, "pre-e2e-gate", "failed", detail);
      throw new Error(detail);
    }
  }

  async function finalizeFailure(runId, laneResult) {
    const failure = laneResult.failure ||
      classifyFailure({
        lane: e2eStore.getRun(runId)?.lane,
        activeLane: laneResult.lane,
        session: laneResult.session,
        buildEvents: laneResult.buildEvents || [],
        warnings: laneResult.warnings || [],
        detail: laneResult.detail || "",
        timedOut: laneResult.timedOut || false,
        uiAuthFailed: laneResult.uiAuthFailed || false,
        uiFlowFailed: laneResult.uiFlowFailed || false,
      });

    let run = e2eStore.updateRun(runId, {
      status: failure.failureClass === "auth_required" ? "auth_required" : "failed",
      failure_class: failure.failureClass,
      failure_detail: failure.failureDetail,
      finished_at: new Date().toISOString(),
      build_session_id: laneResult.sessionId || e2eStore.getRun(runId)?.buildSessionId,
    });

    if (!run.keepRepo) {
      await cleanupAfterLane(runId, laneResult);
      run = e2eStore.getRun(runId);
    }

    const snapshot = await buildSnapshot(laneResult, {
      summary: failure.failureDetail,
    });
    const report = persistReport(run, snapshot);
    e2eStore.updateRun(runId, {
      report_json_path: report.reportJsonPath,
      report_markdown_path: report.reportMarkdownPath,
      artifact_refs: report.artifactRefs,
    });

    appendStep(runId, laneResult.lane || run.activeLane || run.lane, "lane.failed", "failed", failure.failureDetail);
    return snapshot;
  }

  async function cleanupAfterLane(runId, laneResult) {
    const run = e2eStore.getRun(runId);
    if (!run || run.keepRepo) {
      return;
    }

    const detailRun = e2eStore.updateRun(runId, {
      repo_full_name: laneResult.session?.github_repo || run.repoFullName || "",
      build_session_id: laneResult.sessionId || run.buildSessionId,
    });

    await cleanupTempRepo(detailRun, {
      buildSessionStore,
      githubSnapshots,
      force: false,
    });
  }

  async function cleanupTempRepo(run, { buildSessionStore, githubSnapshots, force = false }) {
    if (run.keepRepo && !force) {
      e2eStore.updateRun(run.id, {
        cleanup_status: "skipped",
        cleanup_detail: "keepRepo=true",
      });
      return e2eStore.getRun(run.id);
    }

    if (!run.buildSessionId) {
      e2eStore.updateRun(run.id, {
        cleanup_status: "skipped",
        cleanup_detail: "No build session recorded.",
      });
      return e2eStore.getRun(run.id);
    }

    const session = buildSessionStore.getSession(run.buildSessionId);
    if (!session?.github_repo) {
      e2eStore.updateRun(run.id, {
        cleanup_status: "skipped",
        cleanup_detail: "No provisioned repo recorded.",
      });
      return e2eStore.getRun(run.id);
    }

    appendStep(run.id, e2eStore.getRun(run.id)?.activeLane || run.lane, "cleanup", "running", `Deleting ${session.github_repo}.`);
    try {
      const result = await githubSnapshots.cleanupRepo(session);
      e2eStore.updateRun(run.id, {
        cleanup_status: result.cleaned ? "deleted" : "skipped",
        cleanup_detail: result.detail,
        status:
          e2eStore.getRun(run.id)?.status === "passed" && result.cleaned
            ? "cleaned_up"
            : e2eStore.getRun(run.id)?.status,
      });
      appendStep(run.id, e2eStore.getRun(run.id)?.activeLane || run.lane, "cleanup", "passed", result.detail);
    } catch (error) {
      e2eStore.updateRun(run.id, {
        cleanup_status: "failed",
        cleanup_detail: error.message,
      });
      appendStep(run.id, e2eStore.getRun(run.id)?.activeLane || run.lane, "cleanup", "failed", error.message);
    }
    return e2eStore.getRun(run.id);
  }

  function persistReport(run, snapshot) {
    return reportWriter.write(e2eStore.getRun(run.id) || run, snapshot);
  }

  async function buildSnapshot(context, { summary = "", errors = [] } = {}) {
    const session = context?.sessionId
      ? buildSessionStore.getSession(context.sessionId)
      : context?.session || null;
    const githubSnapshot = context?.githubSnapshot || (session ? await githubSnapshots.collect(session) : baseSnapshot());

    return {
      summary,
      pipelineActive: githubSnapshot.pipelineActive || null,
      labels: githubSnapshot.labels || [],
      secrets: githubSnapshot.secrets || [],
      variables: githubSnapshot.variables || {},
      issues: githubSnapshot.issues || [],
      pullRequests: githubSnapshot.pullRequests || [],
      workflowRuns: githubSnapshot.workflowRuns || [],
      errors,
    };
  }

  function mergeLaneMetadata(runId, laneResult) {
    const run = e2eStore.getRun(runId);
    const metadata = { ...(run?.metadata || {}) };
    const lanes = Array.isArray(metadata.lanes) ? [...metadata.lanes] : [];
    lanes.push({
      lane: laneResult.lane,
      passed: Boolean(laneResult.passed),
      sessionId: laneResult.sessionId || laneResult.session?.id || null,
      repo: laneResult.session?.github_repo || "",
      failure: laneResult.failure || null,
    });
    metadata.lanes = lanes;

    e2eStore.updateRun(runId, {
      metadata,
      build_session_id:
        laneResult.sessionId || laneResult.session?.id || run?.buildSessionId || null,
      repo_full_name: laneResult.session?.github_repo || run?.repoFullName || "",
      repo_url: laneResult.session?.github_repo_url || run?.repoUrl || "",
      root_issue_number:
        laneResult.rootIssueNumber || run?.rootIssueNumber || null,
      first_pr_number: laneResult.firstPrNumber || run?.firstPrNumber || null,
      first_pr_url:
        laneResult.githubSnapshot?.pullRequests?.[0]?.html_url || run?.firstPrUrl || "",
    });
  }

  function appendStep(runId, lane, step, status, detail, evidence = {}) {
    const run = e2eStore.getRun(runId);
    const startedAt = run?.startedAt ? new Date(run.startedAt).getTime() : Date.now();
    return e2eStore.appendEvent(runId, {
      lane,
      step,
      status,
      detail,
      evidence,
      elapsedMs: Date.now() - startedAt,
    });
  }

  function defaultCookieJarPath() {
    return resolveCookieJarPath(projectRoot);
  }
}

function resolveCredentials() {
  const copilotToken =
    process.env.E2E_COPILOT_GITHUB_TOKEN ||
    process.env.PUBLIC_BETA_COPILOT_GITHUB_TOKEN ||
    process.env.COPILOT_GITHUB_TOKEN ||
    "";

  if (!copilotToken) {
    throw new Error("Set E2E_COPILOT_GITHUB_TOKEN or COPILOT_GITHUB_TOKEN before running the harness.");
  }

  return {
    COPILOT_GITHUB_TOKEN: copilotToken,
    ...(readEnvValue("E2E_VERCEL_TOKEN", "VERCEL_TOKEN")
      ? { VERCEL_TOKEN: readEnvValue("E2E_VERCEL_TOKEN", "VERCEL_TOKEN") }
      : {}),
    ...(readEnvValue("E2E_VERCEL_ORG_ID", "VERCEL_ORG_ID")
      ? { VERCEL_ORG_ID: readEnvValue("E2E_VERCEL_ORG_ID", "VERCEL_ORG_ID") }
      : {}),
    ...(readEnvValue("E2E_VERCEL_PROJECT_ID", "VERCEL_PROJECT_ID")
      ? { VERCEL_PROJECT_ID: readEnvValue("E2E_VERCEL_PROJECT_ID", "VERCEL_PROJECT_ID") }
      : {}),
  };
}

function readEnvValue(primary, fallback) {
  return process.env[primary] || process.env[fallback] || "";
}

function collectWarnings(buildEvents) {
  return buildEvents
    .filter((event) => event.kind === "bootstrap_warning" || /state\.json/i.test(event.data?.detail || ""))
    .map((event) => event.data?.detail || "")
    .filter(Boolean);
}

function verifyProvisionSnapshot(snapshot) {
  if (!snapshot?.repo?.fullName) {
    return { ok: false, detail: "Provisioning did not produce a repository." };
  }

  const missingLabels = REQUIRED_BOOTSTRAP_LABELS.filter((label) => !snapshot.labels.includes(label));
  if (missingLabels.length) {
    return { ok: false, detail: `Missing bootstrap labels: ${missingLabels.join(", ")}` };
  }

  const missingSecrets = REQUIRED_BOOTSTRAP_SECRETS.filter((secret) => !snapshot.secrets.includes(secret));
  if (missingSecrets.length) {
    return { ok: false, detail: `Missing bootstrap secrets: ${missingSecrets.join(", ")}` };
  }

  for (const [key, expectation] of Object.entries(REQUIRED_BOOTSTRAP_VARIABLES)) {
    const value = snapshot.variables[key];
    if (!value) {
      return { ok: false, detail: `Missing bootstrap variable ${key}.` };
    }
    if (expectation !== "required" && String(value) !== expectation) {
      return { ok: false, detail: `Unexpected ${key} value: ${value}` };
    }
  }

  return { ok: true };
}

function verifyDecomposerSnapshot(snapshot, rootIssueNumber) {
  const childIssues = snapshot.issues.filter((issue) => issue.number !== rootIssueNumber);
  if (childIssues.length === 0) {
    return { ok: false, detail: "No child issues were recorded." };
  }

  const unlabeledChildren = childIssues.filter(
    (issue) => !issue.labels.some((label) => TYPED_ISSUE_LABELS.has(label))
  );
  if (unlabeledChildren.length > 0) {
    return {
      ok: false,
      detail: `Child issues without typed labels: ${unlabeledChildren.map((issue) => `#${issue.number}`).join(", ")}`,
    };
  }

  return { ok: true };
}

function verifyFirstPrSnapshot(snapshot, firstPrNumber) {
  if (!firstPrNumber && snapshot.pullRequests.length === 0) {
    return { ok: false, detail: "No pull request was opened." };
  }
  return { ok: true };
}

function failLaneResult(lane, context, options = {}) {
  return {
    lane,
    passed: false,
    sessionId: context?.sessionId || context?.session?.id || null,
    session: context?.session || null,
    buildEvents: options.buildEvents || context?.buildEvents || [],
    warnings: context?.warnings || [],
    githubSnapshot: context?.githubSnapshot || baseSnapshot(),
    timedOut: Boolean(options.timedOut),
    uiAuthFailed: Boolean(options.uiAuthFailed),
    uiFlowFailed: Boolean(options.uiFlowFailed),
    failure: classifyFailure({
      lane,
      activeLane: lane,
      session: context?.session || null,
      buildEvents: options.buildEvents || context?.buildEvents || [],
      warnings: context?.warnings || [],
      detail: options.detail || "",
      timedOut: Boolean(options.timedOut),
      uiAuthFailed: Boolean(options.uiAuthFailed),
      uiFlowFailed: Boolean(options.uiFlowFailed),
    }),
  };
}

function baseSnapshot() {
  return {
    labels: [],
    secrets: [],
    variables: {},
    pipelineActive: null,
    issues: [],
    pullRequests: [],
    workflowRuns: [],
  };
}

function parseCookieValue(cookieHeader, key) {
  const match = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${key}=`));
  return match ? match.slice(key.length + 1) : "";
}

function stripTrailingSlash(value) {
  return value.replace(/\/$/, "");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  createE2EHarness,
};
