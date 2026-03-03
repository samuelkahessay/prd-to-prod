using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using TicketDeflection.Data;
using TicketDeflection.Models;

namespace TicketDeflection.Tests;

public class ComplianceEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public ComplianceEndpointTests(WebApplicationFactory<Program> factory)
    {
        var dbName = $"ComplianceEndpointTestDb_{Guid.NewGuid()}";
        _factory = factory.WithWebHostBuilder(b =>
            b.ConfigureServices(services =>
            {
                var existing = services.SingleOrDefault(d => d.ServiceType == typeof(DbContextOptions<TicketDbContext>));
                if (existing != null) services.Remove(existing);
                services.AddDbContext<TicketDbContext>(o =>
                    o.UseInMemoryDatabase(dbName));
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
            operatorId = "test-operator",
            decision = "approve",
            notes = "test"
        });

        Assert.Equal(HttpStatusCode.BadRequest, decisionResponse.StatusCode);
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
