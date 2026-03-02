using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using TicketDeflection.DTOs;
using TicketDeflection.Services;

namespace TicketDeflection.Tests;

public class AutonomyEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public AutonomyEndpointTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    private HttpClient CreateClientWithLedger(string tempDir)
    {
        return _factory.WithWebHostBuilder(b =>
        {
            b.ConfigureServices(services =>
            {
                // Replace the singleton ledger service with one pointing at our temp dir.
                var existing = services.SingleOrDefault(d => d.ServiceType == typeof(AutonomyLedgerService));
                if (existing != null) services.Remove(existing);
                services.AddSingleton(new AutonomyLedgerService(tempDir));
            });
        }).CreateClient();
    }

    [Fact]
    public async Task Decisions_ReturnsOk_WhenNoLedger()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/autonomy/decisions");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Decisions_ReturnsEventsNewestFirst()
    {
        var tmpDir = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString());
        Directory.CreateDirectory(tmpDir);
        try
        {
            var ledgerJson = """
                [
                  {"action":"merge_pipeline_pr","classification":"autonomous","timestamp":"2026-01-01T10:00:00Z","outcome":"acted","reason":null},
                  {"action":"modify_workflows","classification":"human_required","timestamp":"2026-01-02T12:00:00Z","outcome":"queued","reason":null}
                ]
                """;
            File.WriteAllText(Path.Combine(tmpDir, "ledger.json"), ledgerJson);

            var client = CreateClientWithLedger(tmpDir);
            var response = await client.GetAsync("/api/autonomy/decisions");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var body = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(body);
            var events = doc.RootElement.GetProperty("events").EnumerateArray().ToList();
            Assert.Equal(2, events.Count);
            // Newest first: Jan 2 should come before Jan 1
            Assert.Contains("modify_workflows", events[0].GetProperty("action").GetString());
        }
        finally
        {
            Directory.Delete(tmpDir, recursive: true);
        }
    }

    [Fact]
    public async Task Queue_ReturnsSeparateBuckets()
    {
        var tmpDir = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString());
        Directory.CreateDirectory(tmpDir);
        try
        {
            var ledgerJson = """
                [
                  {"action":"merge_pipeline_pr","classification":"autonomous","timestamp":"2026-01-01T10:00:00Z","outcome":"acted","reason":null},
                  {"action":"modify_workflows","classification":"human_required","timestamp":"2026-01-02T12:00:00Z","outcome":"queued","reason":null},
                  {"action":"create_issue","classification":"autonomous","timestamp":"2026-01-03T08:00:00Z","outcome":"blocked","reason":"policy"}
                ]
                """;
            File.WriteAllText(Path.Combine(tmpDir, "ledger.json"), ledgerJson);

            var client = CreateClientWithLedger(tmpDir);
            var response = await client.GetAsync("/api/autonomy/queue");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var body = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(body);
            Assert.True(doc.RootElement.TryGetProperty("blocked", out var blocked));
            Assert.True(doc.RootElement.TryGetProperty("queuedForHuman", out var queued));
            Assert.True(doc.RootElement.TryGetProperty("recentAutonomous", out var autonomous));
            Assert.Equal(1, blocked.GetArrayLength());
            Assert.Equal(1, queued.GetArrayLength());
            Assert.Equal(1, autonomous.GetArrayLength());
        }
        finally
        {
            Directory.Delete(tmpDir, recursive: true);
        }
    }

    [Fact]
    public async Task Metrics_ReturnsAggregatedCounts()
    {
        var tmpDir = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString());
        Directory.CreateDirectory(tmpDir);
        try
        {
            var ledgerJson = """
                [
                  {"action":"merge_pipeline_pr","classification":"autonomous","timestamp":"2026-01-01T10:00:00Z","outcome":"acted","reason":null},
                  {"action":"modify_workflows","classification":"human_required","timestamp":"2026-01-02T12:00:00Z","outcome":"queued","reason":null},
                  {"action":"create_issue","classification":"autonomous","timestamp":"2026-01-03T08:00:00Z","outcome":"escalated","reason":"policy"}
                ]
                """;
            File.WriteAllText(Path.Combine(tmpDir, "ledger.json"), ledgerJson);

            var client = CreateClientWithLedger(tmpDir);
            var response = await client.GetAsync("/api/autonomy/metrics");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var body = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(body);
            Assert.Equal(3, doc.RootElement.GetProperty("totalEvents").GetInt32());
            Assert.Equal(1, doc.RootElement.GetProperty("autonomousActed").GetInt32());
            Assert.Equal(0, doc.RootElement.GetProperty("blocked").GetInt32());
            Assert.Equal(1, doc.RootElement.GetProperty("queuedForHuman").GetInt32());
            Assert.Equal(1, doc.RootElement.GetProperty("escalated").GetInt32());
            Assert.True(doc.RootElement.TryGetProperty("lastUpdated", out _));
        }
        finally
        {
            Directory.Delete(tmpDir, recursive: true);
        }
    }

    [Fact]
    public async Task Metrics_ReturnsEmpty_WhenNoLedger()
    {
        var tmpDir = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString());
        // Don't create the dir — simulate missing ledger
        try
        {
            var client = CreateClientWithLedger(tmpDir);
            var response = await client.GetAsync("/api/autonomy/metrics");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var body = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(body);
            Assert.Equal(0, doc.RootElement.GetProperty("totalEvents").GetInt32());
            Assert.Equal(JsonValueKind.Null, doc.RootElement.GetProperty("lastUpdated").ValueKind);
        }
        finally
        {
            if (Directory.Exists(tmpDir)) Directory.Delete(tmpDir, recursive: true);
        }
    }
}

public class AutonomyLedgerServiceTests
{
    private string CreateTempDir() => Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString());

    [Fact]
    public void GetAllEvents_ReturnsEmpty_WhenNoDirExists()
    {
        var svc = new AutonomyLedgerService("/nonexistent/path");
        Assert.Empty(svc.GetAllEvents());
    }

    [Fact]
    public void GetAllEvents_ParsesArrayFile()
    {
        var dir = CreateTempDir();
        Directory.CreateDirectory(dir);
        try
        {
            File.WriteAllText(Path.Combine(dir, "ledger.json"), """
                [{"action":"a","classification":"autonomous","timestamp":"2026-01-01T00:00:00Z","outcome":null,"reason":null}]
                """);
            var svc = new AutonomyLedgerService(dir);
            var events = svc.GetAllEvents();
            Assert.Single(events);
            Assert.Equal("a", events[0].Action);
        }
        finally { Directory.Delete(dir, recursive: true); }
    }

    [Fact]
    public void GetAllEvents_ParsesSingleObjectFile()
    {
        var dir = CreateTempDir();
        Directory.CreateDirectory(dir);
        try
        {
            File.WriteAllText(Path.Combine(dir, "event.json"), """
                {"action":"b","classification":"human_required","timestamp":"2026-01-02T00:00:00Z","outcome":"queued","reason":"policy"}
                """);
            var svc = new AutonomyLedgerService(dir);
            var events = svc.GetAllEvents();
            Assert.Single(events);
            Assert.Equal("human_required", events[0].Classification);
        }
        finally { Directory.Delete(dir, recursive: true); }
    }

    [Fact]
    public void GetAllEvents_SkipsMalformedFiles()
    {
        var dir = CreateTempDir();
        Directory.CreateDirectory(dir);
        try
        {
            File.WriteAllText(Path.Combine(dir, "bad.json"), "not json {{{");
            File.WriteAllText(Path.Combine(dir, "good.json"), """
                [{"action":"c","classification":"autonomous","timestamp":"2026-01-03T00:00:00Z","outcome":"acted","reason":null}]
                """);
            var svc = new AutonomyLedgerService(dir);
            var events = svc.GetAllEvents();
            Assert.Single(events);
        }
        finally { Directory.Delete(dir, recursive: true); }
    }

    [Fact]
    public void GetQueue_GroupsCorrectly()
    {
        var dir = CreateTempDir();
        Directory.CreateDirectory(dir);
        try
        {
            File.WriteAllText(Path.Combine(dir, "ledger.json"), """
                [
                  {"action":"x","classification":"autonomous","timestamp":"2026-01-01T00:00:00Z","outcome":"acted","reason":null},
                  {"action":"y","classification":"human_required","timestamp":"2026-01-02T00:00:00Z","outcome":"queued","reason":null},
                  {"action":"z","classification":"autonomous","timestamp":"2026-01-03T00:00:00Z","outcome":"blocked","reason":"gate"}
                ]
                """);
            var svc = new AutonomyLedgerService(dir);
            var q = svc.GetQueue();
            Assert.Single(q.Blocked);
            Assert.Single(q.QueuedForHuman);
            Assert.Single(q.RecentAutonomous);
        }
        finally { Directory.Delete(dir, recursive: true); }
    }

    [Fact]
    public void GetMetrics_AggregatesCorrectly()
    {
        var dir = CreateTempDir();
        Directory.CreateDirectory(dir);
        try
        {
            File.WriteAllText(Path.Combine(dir, "ledger.json"), """
                [
                  {"action":"a","classification":"autonomous","timestamp":"2026-01-01T00:00:00Z","outcome":"acted","reason":null},
                  {"action":"b","classification":"human_required","timestamp":"2026-01-02T00:00:00Z","outcome":"queued","reason":null},
                  {"action":"c","classification":"autonomous","timestamp":"2026-01-03T00:00:00Z","outcome":"escalated","reason":null}
                ]
                """);
            var svc = new AutonomyLedgerService(dir);
            var m = svc.GetMetrics();
            Assert.Equal(3, m.TotalEvents);
            Assert.Equal(1, m.AutonomousActed);
            Assert.Equal(0, m.Blocked);
            Assert.Equal(1, m.QueuedForHuman);
            Assert.Equal(1, m.Escalated);
            Assert.NotNull(m.LastUpdated);
        }
        finally { Directory.Delete(dir, recursive: true); }
    }
}
