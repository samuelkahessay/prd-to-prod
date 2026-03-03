using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Logging.Abstractions;
using TicketDeflection.Services;

namespace TicketDeflection.Tests;

public class DecisionLedgerServiceTests : IDisposable
{
    private readonly string _tempDir;
    private readonly string _decisionsDir;

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower
    };

    public DecisionLedgerServiceTests()
    {
        _tempDir = Path.Combine(Path.GetTempPath(), $"decision-ledger-tests-{Guid.NewGuid():N}");
        _decisionsDir = Path.Combine(_tempDir, "decisions");
        Directory.CreateDirectory(_decisionsDir);
    }

    [Fact]
    public async Task GetDecisionsAsync_ReturnsNewestFirst_AndSkipsInvalidFiles()
    {
        WriteEvent(new DecisionEvent(
            1,
            "older",
            "2026-03-02T20:18:40Z",
            new DecisionActor("workflow", "pr-review-submit"),
            "pr-review-submit",
            "auto_merge_pipeline_pr",
            new PolicyResult("autonomous", null),
            new DecisionTarget("pull_request", "284", null, "[Pipeline] PR #284"),
            ["Formal APPROVE review posted"],
            "acted",
            "Older event",
            null));

        WriteEvent(new DecisionEvent(
            1,
            "newer",
            "2026-03-02T20:19:05Z",
            new DecisionActor("workflow", "pr-review-submit"),
            "pr-review-submit",
            "workflow_file_change",
            new PolicyResult("human_required", "Control-plane change"),
            new DecisionTarget("file", null, ".github/workflows/auto-dispatch.yml", ".github/workflows/auto-dispatch.yml"),
            ["Workflow file touched"],
            "blocked",
            "Newer event",
            "repo maintainer"));

        File.WriteAllText(Path.Combine(_decisionsDir, "invalid.json"), "{not-json");

        var service = CreateService();
        var events = await service.GetDecisionsAsync();

        Assert.Collection(events,
            first => Assert.Equal("newer", first.EventId),
            second => Assert.Equal("older", second.EventId));
    }

    [Fact]
    public async Task GetQueueAsync_GroupsBlockedQueuedAndAutonomous()
    {
        WriteEvent(new DecisionEvent(
            1,
            "acted-autonomous",
            "2026-03-02T20:18:40Z",
            new DecisionActor("workflow", "pr-review-submit"),
            "pr-review-submit",
            "auto_merge_pipeline_pr",
            new PolicyResult("autonomous", null),
            new DecisionTarget("pull_request", "284", null, "[Pipeline] PR #284"),
            ["Formal APPROVE review posted"],
            "acted",
            "Acted autonomously",
            null));

        WriteEvent(new DecisionEvent(
            1,
            "blocked-human",
            "2026-03-02T20:19:05Z",
            new DecisionActor("workflow", "pr-review-submit"),
            "pr-review-submit",
            "workflow_file_change",
            new PolicyResult("human_required", "Control-plane change"),
            new DecisionTarget("file", null, ".github/workflows/auto-dispatch.yml", ".github/workflows/auto-dispatch.yml"),
            ["Workflow file touched"],
            "blocked",
            "Blocked",
            "repo maintainer"));

        WriteEvent(new DecisionEvent(
            1,
            "queued-human",
            "2026-03-02T20:20:12Z",
            new DecisionActor("service", "demo-preflight"),
            "demo-preflight",
            "secret_or_token_change",
            new PolicyResult("human_required", "Credentials remain human-owned"),
            new DecisionTarget("secret", null, null, "GH_AW_GITHUB_TOKEN"),
            ["Secret rotation changes system authority"],
            "queued_for_human",
            "Queued for human",
            "repo maintainer"));

        var service = CreateService();
        var queue = await service.GetQueueAsync();

        Assert.Single(queue.Blocked);
        Assert.Equal("blocked-human", queue.Blocked[0].EventId);
        Assert.Single(queue.QueuedForHuman);
        Assert.Equal("queued-human", queue.QueuedForHuman[0].EventId);
        Assert.Single(queue.RecentAutonomous);
        Assert.Equal("acted-autonomous", queue.RecentAutonomous[0].EventId);
    }

    [Fact]
    public async Task GetMetricsAsync_ReturnsExpectedCountsAndLastUpdated()
    {
        WriteEvent(new DecisionEvent(
            1,
            "acted-autonomous",
            "2026-03-02T20:18:40Z",
            new DecisionActor("workflow", "pr-review-submit"),
            "pr-review-submit",
            "auto_merge_pipeline_pr",
            new PolicyResult("autonomous", null),
            new DecisionTarget("pull_request", "284", null, "[Pipeline] PR #284"),
            ["Formal APPROVE review posted"],
            "acted",
            "Acted autonomously",
            null));

        WriteEvent(new DecisionEvent(
            1,
            "blocked-human",
            "2026-03-02T20:19:05Z",
            new DecisionActor("workflow", "pr-review-submit"),
            "pr-review-submit",
            "workflow_file_change",
            new PolicyResult("human_required", "Control-plane change"),
            new DecisionTarget("file", null, ".github/workflows/auto-dispatch.yml", ".github/workflows/auto-dispatch.yml"),
            ["Workflow file touched"],
            "blocked",
            "Blocked",
            "repo maintainer"));

        WriteEvent(new DecisionEvent(
            1,
            "queued-human",
            "2026-03-02T20:20:12Z",
            new DecisionActor("service", "demo-preflight"),
            "demo-preflight",
            "secret_or_token_change",
            new PolicyResult("human_required", "Credentials remain human-owned"),
            new DecisionTarget("secret", null, null, "GH_AW_GITHUB_TOKEN"),
            ["Secret rotation changes system authority"],
            "queued_for_human",
            "Queued for human",
            "repo maintainer"));

        WriteEvent(new DecisionEvent(
            1,
            "escalated-human",
            "2026-03-02T20:20:30Z",
            new DecisionActor("workflow", "pipeline-watchdog"),
            "pipeline-watchdog",
            "ci_repair_existing_pr",
            new PolicyResult("human_required", "Escalated after repeated failure"),
            new DecisionTarget("issue", "401", null, "CI incident #401"),
            ["Repeated repair attempts exhausted"],
            "escalated",
            "Escalated to human",
            "repo maintainer"));

        var service = CreateService();
        var metrics = await service.GetMetricsAsync();

        Assert.Equal(4, metrics.TotalEvents);
        Assert.Equal(1, metrics.AutonomousActed);
        Assert.Equal(1, metrics.Blocked);
        Assert.Equal(1, metrics.QueuedForHuman);
        Assert.Equal(1, metrics.Escalated);
        Assert.Equal("2026-03-02T20:20:30Z", metrics.LastUpdatedUtc);
    }

    [Fact]
    public async Task GetDecisionsAsync_CorrectedEvent_SupersedesOriginal()
    {
        WriteEvent(new DecisionEvent(
            1,
            "original-event",
            "2026-03-02T20:18:40Z",
            new DecisionActor("workflow", "pr-review-submit"),
            "pr-review-submit",
            "sensitive_app_change",
            new PolicyResult("human_required", "App config change"),
            new DecisionTarget("file", null, "appsettings.json", "appsettings.json"),
            ["Config file modified"],
            "queued_for_human",
            "Original event",
            "repo maintainer"));

        WriteEvent(new DecisionEvent(
            1,
            "original-event-CORRECTED",
            "2026-03-03T02:02:00Z",
            new DecisionActor("workflow", "pr-review-submit"),
            "pr-review-submit",
            "sensitive_app_change",
            new PolicyResult("human_required", "App config change"),
            new DecisionTarget("file", null, "appsettings.json", "appsettings.json"),
            ["Config file modified"],
            "queued_for_human",
            "Corrected event",
            "repo maintainer",
            Replaces: "original-event"));

        var service = CreateService();
        var events = await service.GetDecisionsAsync();

        Assert.Single(events);
        Assert.Equal("original-event-CORRECTED", events[0].EventId);
    }

    public void Dispose()
    {
        if (Directory.Exists(_tempDir))
        {
            Directory.Delete(_tempDir, recursive: true);
        }
    }

    private DecisionLedgerService CreateService()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["DecisionLedger:Path"] = _decisionsDir
            })
            .Build();

        return new DecisionLedgerService(
            configuration,
            new TestWebHostEnvironment(_tempDir),
            NullLogger<DecisionLedgerService>.Instance);
    }

    private void WriteEvent(DecisionEvent evt)
    {
        var json = JsonSerializer.Serialize(evt, JsonOpts);
        File.WriteAllText(Path.Combine(_decisionsDir, $"{evt.EventId}.json"), json);
    }

    private sealed class TestWebHostEnvironment(string contentRootPath) : IWebHostEnvironment
    {
        public string ApplicationName { get; set; } = "TicketDeflection.Tests";
        public IFileProvider WebRootFileProvider { get; set; } = new NullFileProvider();
        public string WebRootPath { get; set; } = contentRootPath;
        public string EnvironmentName { get; set; } = "Development";
        public string ContentRootPath { get; set; } = contentRootPath;
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
