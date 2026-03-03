using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using TicketDeflection.Services;

namespace TicketDeflection.Tests;

public class AutonomyEndpointTests : IDisposable
{
    private readonly string _tempDir;
    private readonly string _decisionsDir;
    private readonly WebApplicationFactory<Program> _factory;

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower
    };

    public AutonomyEndpointTests()
    {
        _tempDir = Path.Combine(Path.GetTempPath(), $"autonomy-endpoint-tests-{Guid.NewGuid():N}");
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
            builder.ConfigureServices(services =>
            {
                TestFactoryExtensions.ReplaceDbWithInMemory(services, $"AutonomyTestDb_{Guid.NewGuid()}");
            });
        });
    }

    [Fact]
    public async Task GetDecisions_ReturnsNewestFirst()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/autonomy/decisions");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);

        Assert.Equal("20260302T202012Z-secret-rotation-queued-for-human", doc.RootElement[0].GetProperty("eventId").GetString());
        Assert.Equal("20260302T201905Z-workflow-file-change-blocked", doc.RootElement[1].GetProperty("eventId").GetString());
        Assert.Equal("20260302T201840Z-auto-merge-pipeline-pr-acted", doc.RootElement[2].GetProperty("eventId").GetString());
    }

    [Fact]
    public async Task GetQueue_ReturnsExpectedBuckets()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/autonomy/queue");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        var root = doc.RootElement;

        Assert.Equal(1, root.GetProperty("blocked").GetArrayLength());
        Assert.Equal(1, root.GetProperty("queuedForHuman").GetArrayLength());
        Assert.Equal(1, root.GetProperty("recentAutonomous").GetArrayLength());
    }

    [Fact]
    public async Task GetMetrics_ReturnsExpectedCounts()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/autonomy/metrics");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        var root = doc.RootElement;

        Assert.Equal(3, root.GetProperty("totalEvents").GetInt32());
        Assert.Equal(1, root.GetProperty("autonomousActed").GetInt32());
        Assert.Equal(1, root.GetProperty("blocked").GetInt32());
        Assert.Equal(1, root.GetProperty("queuedForHuman").GetInt32());
        Assert.Equal(0, root.GetProperty("escalated").GetInt32());
        Assert.Equal("2026-03-02T20:20:12Z", root.GetProperty("lastUpdatedUtc").GetString());
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
