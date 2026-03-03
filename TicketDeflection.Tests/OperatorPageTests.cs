using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using TicketDeflection.Services;

namespace TicketDeflection.Tests;

public class OperatorPageTests : IDisposable
{
    private readonly string _tempDir;
    private readonly string _decisionsDir;
    private readonly string _reportsDir;
    private readonly WebApplicationFactory<Program> _factory;

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower
    };

    public OperatorPageTests()
    {
        _tempDir = Path.Combine(Path.GetTempPath(), $"operator-page-tests-{Guid.NewGuid():N}");
        _decisionsDir = Path.Combine(_tempDir, "decisions");
        Directory.CreateDirectory(_decisionsDir);

        _reportsDir = Path.Combine(_tempDir, "reports");
        Directory.CreateDirectory(_reportsDir);

        WriteDrillReport(new
        {
            drill_id = "20260302-152002",
            drill_type = "main_build_syntax",
            failure_signature = "cs1002-missing-semicolon",
            verdict = "PASS",
            verdict_reason = (string?)null,
            started_at = "2026-03-02T15:20:03Z",
            completed_at = "2026-03-02T15:32:25Z",
            stages = new Dictionary<string, object>
            {
                ["ci_failure"] = new { status = "pass", timestamp = "2026-03-02T15:20:07Z", elapsed_from_previous_s = 3, sla_s = 120, url = "" },
                ["issue_created"] = new { status = "pass", timestamp = "2026-03-02T15:21:03Z", elapsed_from_previous_s = 56, sla_s = 120, url = "" },
                ["auto_dispatch"] = new { status = "pass", timestamp = "2026-03-02T15:21:33Z", elapsed_from_previous_s = 30, sla_s = 120, url = "" },
                ["repair_pr"] = new { status = "pass", timestamp = "2026-03-02T15:26:24Z", elapsed_from_previous_s = 291, sla_s = 600, url = "" },
                ["ci_green"] = new { status = "pass", timestamp = "2026-03-02T15:27:08Z", elapsed_from_previous_s = 44, sla_s = 900, url = "" },
                ["auto_merge"] = new { status = "pass", timestamp = "2026-03-02T15:30:09Z", elapsed_from_previous_s = 181, sla_s = 600, url = "" },
                ["main_recovered"] = new { status = "pass", timestamp = "2026-03-02T15:32:17Z", elapsed_from_previous_s = 128, sla_s = 300, url = "" }
            }
        });

        WriteDrillReport(new
        {
            drill_id = "audit-manual-001",
            drill_type = "manual-audit",
            failure_signature = "bootstrap-dispatch",
            verdict = "PASS_WITH_MANUAL_RESUME",
            verdict_reason = "Manual label retrigger required during bootstrap.",
            started_at = "2026-03-02T21:00:00Z",
            completed_at = "2026-03-02T21:00:09Z",
            stages = new Dictionary<string, object>
            {
                ["ci_failure"] = new { status = "pass", timestamp = "2026-03-02T10:00:00Z", elapsed_from_previous_s = (int?)null, sla_s = 120, url = "" },
                ["issue_created"] = new { status = "pass", timestamp = "2026-03-02T10:00:20Z", elapsed_from_previous_s = 20, sla_s = 120, url = "" },
                ["auto_dispatch"] = new { status = "pass_manual", timestamp = "2026-03-02T10:03:00Z", elapsed_from_previous_s = 160, sla_s = 120, url = "" },
                ["repair_pr"] = new { status = "pass", timestamp = "2026-03-02T10:06:00Z", elapsed_from_previous_s = 180, sla_s = 600, url = "" },
                ["ci_green"] = new { status = "pass", timestamp = "2026-03-02T10:08:00Z", elapsed_from_previous_s = 120, sla_s = 900, url = "" },
                ["auto_merge"] = new { status = "pass", timestamp = "2026-03-02T10:10:30Z", elapsed_from_previous_s = 150, sla_s = 600, url = "" },
                ["main_recovered"] = new { status = "pass", timestamp = "2026-03-02T10:11:11Z", elapsed_from_previous_s = 41, sla_s = 300, url = "" }
            }
        });

        WriteDrillReport(new
        {
            drill_id = "audit-evidence-001",
            drill_type = "audit",
            failure_signature = "evidence-gap",
            verdict = "FAIL",
            verdict_reason = "Durable auto-merge evidence missing.",
            started_at = "2026-03-02T22:00:00Z",
            completed_at = "2026-03-02T22:00:08Z",
            stages = new Dictionary<string, object>
            {
                ["ci_failure"] = new { status = "pass", timestamp = "2026-03-02T11:00:00Z", elapsed_from_previous_s = (int?)null, sla_s = 120, url = "" },
                ["issue_created"] = new { status = "pass", timestamp = "2026-03-02T11:00:20Z", elapsed_from_previous_s = 20, sla_s = 120, url = "" },
                ["auto_dispatch"] = new { status = "pass", timestamp = "2026-03-02T11:01:00Z", elapsed_from_previous_s = 40, sla_s = 120, url = "" },
                ["repair_pr"] = new { status = "pass", timestamp = "2026-03-02T11:02:00Z", elapsed_from_previous_s = 60, sla_s = 600, url = "" },
                ["ci_green"] = new { status = "pass", timestamp = "2026-03-02T11:03:00Z", elapsed_from_previous_s = 60, sla_s = 900, url = "" },
                ["auto_merge"] = new { status = "pass", timestamp = "2026-03-02T11:04:00Z", elapsed_from_previous_s = 60, sla_s = 600, url = "" },
                ["main_recovered"] = new { status = "pass", timestamp = "2026-03-02T11:06:00Z", elapsed_from_previous_s = 120, sla_s = 300, url = "" }
            }
        });

        WriteEvent(new DecisionEvent(
            1,
            "20260302T201840Z-auto-merge-pipeline-pr-acted",
            "2026-03-02T20:18:40Z",
            new DecisionActor("workflow", "pr-review-submit"),
            "pr-review-submit",
            "auto_merge_pipeline_pr",
            new PolicyResult("autonomous", null),
            new DecisionTarget("pull_request", "284", null, "[Pipeline] PR #284"),
            ["Formal APPROVE review posted"],
            "acted",
            "Auto-merge armed after approval on PR #284.",
            null));

        WriteEvent(new DecisionEvent(
            1,
            "20260302T201905Z-workflow-file-change-blocked",
            "2026-03-02T20:19:05Z",
            new DecisionActor("workflow", "pr-review-submit"),
            "pr-review-submit",
            "workflow_file_change",
            new PolicyResult("human_required", "Workflow changes alter the control plane and can widen blast radius across the repo."),
            new DecisionTarget("file", null, ".github/workflows/auto-dispatch.yml", ".github/workflows/auto-dispatch.yml"),
            ["Workflow file touched"],
            "blocked",
            "Autonomous merge blocked because the PR touched a workflow file.",
            "repo maintainer"));

        WriteEvent(new DecisionEvent(
            1,
            "20260302T202012Z-secret-rotation-queued-for-human",
            "2026-03-02T20:20:12Z",
            new DecisionActor("service", "demo-preflight"),
            "demo-preflight",
            "secret_or_token_change",
            new PolicyResult("human_required", "Credentials and kill-switch variables govern system authority and must stay under human control."),
            new DecisionTarget("secret", null, null, "GH_AW_GITHUB_TOKEN"),
            ["Secret rotation changes system authority"],
            "queued_for_human",
            "Token rotation requires human action outside the autonomous lane.",
            "repo maintainer"));

        WriteEvent(new DecisionEvent(
            1,
            "20260302T201700Z-ci-repair-escalated",
            "2026-03-02T20:17:00Z",
            new DecisionActor("workflow", "pipeline-watchdog"),
            "pipeline-watchdog",
            "ci_repair_existing_pr",
            new PolicyResult("human_required", "Repeated repair attempts exhausted."),
            new DecisionTarget("issue", "401", null, "CI incident #401"),
            ["Repair attempts exhausted"],
            "escalated",
            "Escalated repair is still visible in the full decision trail.",
            "repo maintainer"));

        WriteEvent(new DecisionEvent(
            1,
            "20260302T201600Z-branch-protection-escalated",
            "2026-03-02T20:16:00Z",
            new DecisionActor("workflow", "pr-review-submit"),
            "pr-review-submit",
            "branch_protection_change",
            new PolicyResult("human_required", "Branch protection stays under human control."),
            new DecisionTarget("repository", null, null, "main protection"),
            ["Branch protection touched"],
            "escalated",
            "Branch protection escalation is visible in the full decision trail.",
            "repo maintainer"));

        WriteEvent(new DecisionEvent(
            1,
            "20260302T201500Z-deploy-policy-escalated",
            "2026-03-02T20:15:00Z",
            new DecisionActor("workflow", "demo-preflight"),
            "demo-preflight",
            "deploy_policy_change",
            new PolicyResult("human_required", "Deploy policy stays under human control."),
            new DecisionTarget("file", null, "autonomy-policy.yml", "autonomy-policy.yml"),
            ["Deploy policy touched"],
            "escalated",
            "Deploy policy escalation is visible in the full decision trail.",
            "repo maintainer"));

        WriteEvent(new DecisionEvent(
            1,
            "20260302T201400Z-oldest-escalated",
            "2026-03-02T20:14:00Z",
            new DecisionActor("workflow", "pipeline-watchdog"),
            "pipeline-watchdog",
            "manual_follow_up",
            new PolicyResult("human_required", "Oldest event should still appear in the trail."),
            new DecisionTarget("issue", "399", null, "Historical incident #399"),
            ["Historical evidence retained"],
            "escalated",
            "Oldest decision remains visible in the decision trail.",
            "repo maintainer"));

        _factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.ConfigureAppConfiguration((_, config) =>
                config.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["DecisionLedger:Path"] = _decisionsDir,
                    ["DrillReports:Path"] = _reportsDir,
                    ["DemoSeed:Enabled"] = "false"
                }));
        });
    }

    [Fact]
    public async Task Operator_Returns200()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/operator");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Operator_RendersBlockedQueuedAndAutonomousSections()
    {
        var client = _factory.CreateClient();
        var html = await client.GetStringAsync("/operator");

        Assert.Contains("Operator Queue", html);
        Assert.Contains("Human-required refusals", html);
        Assert.Contains("Waiting on an operator", html);
        Assert.Contains("Recent autonomous actions", html);
        Assert.Contains("The system stops before it can widen its own authority.", html);
    }

    [Fact]
    public async Task Operator_RendersDecisionSummaries()
    {
        var client = _factory.CreateClient();
        var html = await client.GetStringAsync("/operator");

        Assert.Contains("Autonomous merge blocked because the PR touched a workflow file.", html);
        Assert.Contains("Token rotation requires human action outside the autonomous lane.", html);
        Assert.Contains("Auto-merge armed after approval on PR #284.", html);
        Assert.Contains(".github/workflows/auto-dispatch.yml", html);
        Assert.Contains("GH_AW_GITHUB_TOKEN", html);
        Assert.Contains("human-owned control plane", html);
        Assert.Contains("Workflow changes alter the control plane and can widen blast radius across the repo.", html);
    }

    [Fact]
    public async Task Operator_RendersPastRunsSection()
    {
        var client = _factory.CreateClient();
        var html = await client.GetStringAsync("/operator");

        Assert.Contains("Past Runs", html);
        Assert.Contains("20260302-152002", html);
        Assert.Contains("PASS", html);
        Assert.Contains("main_build_syntax", html);
        Assert.Contains("cs1002-missing-semicolon", html);
        Assert.Contains("7/7 complete", html);
        Assert.Contains("decision trail", html);
    }

    [Fact]
    public async Task Operator_DecisionTrailIncludesOlderEntriesBeyondRecentSummary()
    {
        var client = _factory.CreateClient();
        var html = await client.GetStringAsync("/operator");

        Assert.Contains("Oldest decision remains visible in the decision trail.", html);
    }

    [Fact]
    public async Task Operator_RendersManualResumeWithoutTreatingItAsHardFailure()
    {
        var client = _factory.CreateClient();
        var html = await client.GetStringAsync("/operator");

        Assert.Contains("PASS_WITH_MANUAL_RESUME", html);
        Assert.Contains("1 manual", html);
        Assert.Contains("7/7 complete", html);
        Assert.Contains("Manual label retrigger required during bootstrap.", html);
        Assert.Contains("11m11s", html);
    }

    [Fact]
    public async Task Operator_RendersVerdictReasonForEvidenceOnlyFailure()
    {
        var client = _factory.CreateClient();
        var html = await client.GetStringAsync("/operator");

        Assert.Contains("audit-evidence-001", html);
        Assert.Contains("Durable auto-merge evidence missing.", html);
    }

    public void Dispose()
    {
        _factory.Dispose();
        if (Directory.Exists(_tempDir))
        {
            Directory.Delete(_tempDir, recursive: true);
        }
    }

    private void WriteEvent(DecisionEvent evt)
    {
        var json = JsonSerializer.Serialize(evt, JsonOpts);
        File.WriteAllText(Path.Combine(_decisionsDir, $"{evt.EventId}.json"), json);
    }

    private void WriteDrillReport(object report)
    {
        var json = JsonSerializer.Serialize(report, JsonOpts);
        File.WriteAllText(Path.Combine(_reportsDir, $"test-drill-{Guid.NewGuid():N}.json"), json);
    }
}
