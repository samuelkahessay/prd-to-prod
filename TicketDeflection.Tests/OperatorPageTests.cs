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

        _factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.ConfigureAppConfiguration((_, config) =>
                config.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["DecisionLedger:Path"] = _decisionsDir,
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
}
