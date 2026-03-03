using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using TicketDeflection.Data;

namespace TicketDeflection.Tests;

public class ComplianceEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _rootFactory;
    private readonly WebApplicationFactory<Program> _factory;
    private readonly WebApplicationFactory<Program> _unauthFactory;

    public ComplianceEndpointTests(WebApplicationFactory<Program> factory)
    {
        _rootFactory = factory;
        var dbName = $"ComplianceEndpointTestDb_{Guid.NewGuid()}";
        _factory = factory.WithTestAuth(dbName);

        // Unauthenticated factory — keeps default cookie auth (no cookie = 401)
        _unauthFactory = factory.WithWebHostBuilder(b =>
            b.ConfigureServices(services =>
            {
                TestFactoryExtensions.ReplaceDbWithInMemory(services, dbName + "_unauth");
            }));
    }

    [Fact]
    public async Task PostScans_Returns201_With_Findings()
    {
        var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/scans", new
        {
            content = "SIN: 123-456-789 in exported log",
            contentType = 3, // ContentType.FREETEXT
            sourceLabel = "test"
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var body = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        Assert.True(doc.RootElement.TryGetProperty("findings", out var findings));
        Assert.True(findings.GetArrayLength() > 0);
    }

    [Fact]
    public async Task GetScans_Returns200_List()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/scans");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        Assert.Equal(JsonValueKind.Array, doc.RootElement.ValueKind);
    }

    [Fact]
    public async Task GetScans_Returns200_List_With_Sqlite()
    {
        var tempDir = CreateTempDirectory();
        try
        {
            var dbPath = Path.Combine(tempDir, "ticketdb.db");
            await using var factory = _rootFactory.WithTestAuthSqlite($"Data Source={dbPath}");
            var client = factory.CreateClient();

            var response = await client.GetAsync("/api/scans");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }
        finally
        {
            Directory.Delete(tempDir, recursive: true);
        }
    }

    [Fact]
    public async Task GetComplianceMetrics_Returns200_With_NumericFields()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/compliance/metrics");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        var root = doc.RootElement;
        Assert.True(root.TryGetProperty("totalScans", out var totalScans));
        Assert.True(root.TryGetProperty("autoBlocked", out _));
        Assert.True(root.TryGetProperty("humanRequired", out _));
        Assert.True(root.TryGetProperty("advisory", out _));
        Assert.True(root.TryGetProperty("pendingDecisions", out _));
        Assert.Equal(JsonValueKind.Number, totalScans.ValueKind);
    }

    [Fact]
    public async Task PostDecision_Returns400_For_AutoBlock_Scan()
    {
        var client = _factory.CreateClient();

        // First create an AUTO_BLOCK scan
        var createResponse = await client.PostAsJsonAsync("/api/scans", new
        {
            content = "SIN: 999-888-777",
            contentType = 3, // ContentType.FREETEXT
            sourceLabel = "test"
        });
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);

        var created = await createResponse.Content.ReadAsStringAsync();
        using var createdDoc = JsonDocument.Parse(created);
        var scanId = createdDoc.RootElement.GetProperty("id").GetString();

        // Attempt to record a decision on the AUTO_BLOCK scan
        var decisionResponse = await client.PostAsJsonAsync($"/api/scans/{scanId}/decision", new
        {
            decision = "Approved",
            notes = "test"
        });

        // AUTO_BLOCK scans should return 400 — decisions only on HUMAN_REQUIRED
        Assert.Equal(HttpStatusCode.BadRequest, decisionResponse.StatusCode);
    }

    [Fact]
    public async Task PostDecision_For_HumanRequired_Scan_MarksScanAsDecided()
    {
        var client = _factory.CreateClient();

        var initialMetricsResponse = await client.GetAsync("/api/compliance/metrics");
        Assert.Equal(HttpStatusCode.OK, initialMetricsResponse.StatusCode);

        var initialMetricsBody = await initialMetricsResponse.Content.ReadAsStringAsync();
        using var initialMetricsDoc = JsonDocument.Parse(initialMetricsBody);
        var pendingBefore = initialMetricsDoc.RootElement.GetProperty("pendingDecisions").GetInt32();

        var createResponse = await client.PostAsJsonAsync("/api/scans", new
        {
            content = "dob: 1990-01-15 in exported user report",
            contentType = "CODE",
            sourceLabel = "test"
        });
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);

        var created = await createResponse.Content.ReadAsStringAsync();
        using var createdDoc = JsonDocument.Parse(created);
        var scanId = createdDoc.RootElement.GetProperty("id").GetString();
        Assert.NotNull(scanId);

        var decisionResponse = await client.PostAsJsonAsync($"/api/scans/{scanId}/decision", new
        {
            decision = "Approved",
            notes = "looks acceptable"
        });
        Assert.Equal(HttpStatusCode.OK, decisionResponse.StatusCode);

        var scansResponse = await client.GetAsync("/api/scans");
        Assert.Equal(HttpStatusCode.OK, scansResponse.StatusCode);

        var scansBody = await scansResponse.Content.ReadAsStringAsync();
        using var scansDoc = JsonDocument.Parse(scansBody);
        var decidedScan = scansDoc.RootElement
            .EnumerateArray()
            .FirstOrDefault(x => x.GetProperty("id").GetString() == scanId);

        Assert.Equal(JsonValueKind.Object, decidedScan.ValueKind);
        Assert.True(decidedScan.GetProperty("hasDecision").GetBoolean());
        Assert.Equal("Approved", decidedScan.GetProperty("latestDecision").GetString());

        var metricsResponse = await client.GetAsync("/api/compliance/metrics");
        Assert.Equal(HttpStatusCode.OK, metricsResponse.StatusCode);

        var metricsBody = await metricsResponse.Content.ReadAsStringAsync();
        using var metricsDoc = JsonDocument.Parse(metricsBody);
        Assert.Equal(pendingBefore, metricsDoc.RootElement.GetProperty("pendingDecisions").GetInt32());
    }

    [Fact]
    public async Task PostDecision_Returns400_For_Advisory_Scan()
    {
        var client = _factory.CreateClient();

        // ADVISORY scan — no violations triggers ADVISORY disposition
        var createResponse = await client.PostAsJsonAsync("/api/scans", new
        {
            content = "GET /api/health HTTP/1.1 200 OK",
            contentType = "FREETEXT",
            sourceLabel = "test"
        });
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);

        var created = await createResponse.Content.ReadAsStringAsync();
        using var createdDoc = JsonDocument.Parse(created);
        var scanId = createdDoc.RootElement.GetProperty("id").GetString();

        var decisionResponse = await client.PostAsJsonAsync($"/api/scans/{scanId}/decision", new
        {
            decision = "Approved",
            notes = "test"
        });

        Assert.Equal(HttpStatusCode.BadRequest, decisionResponse.StatusCode);
    }

    [Fact]
    public async Task PostDecision_Returns401_Without_Auth()
    {
        var client = _unauthFactory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false
        });

        // Create a scan first (public endpoint)
        var createResponse = await client.PostAsJsonAsync("/api/scans", new
        {
            content = "dob: 1990-01-15 in exported user report",
            contentType = "CODE",
            sourceLabel = "test"
        });
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);

        var created = await createResponse.Content.ReadAsStringAsync();
        using var createdDoc = JsonDocument.Parse(created);
        var scanId = createdDoc.RootElement.GetProperty("id").GetString();

        // Decision without auth should return 401
        var decisionResponse = await client.PostAsJsonAsync($"/api/scans/{scanId}/decision", new
        {
            decision = "Approved",
            notes = "test"
        });

        Assert.Equal(HttpStatusCode.Unauthorized, decisionResponse.StatusCode);
    }

    [Fact]
    public async Task PostDecision_Returns409_For_Duplicate_Decision()
    {
        var client = _factory.CreateClient();

        // Create HUMAN_REQUIRED scan
        var createResponse = await client.PostAsJsonAsync("/api/scans", new
        {
            content = "dob: 1990-01-15 in exported user report",
            contentType = "CODE",
            sourceLabel = "test"
        });
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);

        var created = await createResponse.Content.ReadAsStringAsync();
        using var createdDoc = JsonDocument.Parse(created);
        var scanId = createdDoc.RootElement.GetProperty("id").GetString();

        // First decision succeeds
        var firstDecision = await client.PostAsJsonAsync($"/api/scans/{scanId}/decision", new
        {
            decision = "Approved",
            notes = "first"
        });
        Assert.Equal(HttpStatusCode.OK, firstDecision.StatusCode);

        // Second decision should be 409 Conflict
        var secondDecision = await client.PostAsJsonAsync($"/api/scans/{scanId}/decision", new
        {
            decision = "Rejected",
            notes = "second attempt"
        });
        Assert.Equal(HttpStatusCode.Conflict, secondDecision.StatusCode);
    }

    private static string CreateTempDirectory()
    {
        var path = Path.Combine(Path.GetTempPath(), $"TicketDeflectionTests_{Guid.NewGuid():N}");
        Directory.CreateDirectory(path);
        return path;
    }

    [Fact]
    public async Task PostScansSimulate_Count5_Returns200_With_AggregateCounts()
    {
        var client = _factory.CreateClient();

        var response = await client.PostAsync("/api/scans/simulate?count=5", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        var root = doc.RootElement;
        Assert.True(root.TryGetProperty("count", out _));
        Assert.True(root.TryGetProperty("autoBlocked", out _));
        Assert.True(root.TryGetProperty("humanRequired", out _));
        Assert.True(root.TryGetProperty("advisory", out _));
    }
}
