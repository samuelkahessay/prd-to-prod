using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using TicketDeflection.Data;

namespace TicketDeflection.Tests;

public class MetricsEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public MetricsEndpointTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory.WithWebHostBuilder(b =>
            b.ConfigureServices(services =>
            {
                var existing = services.SingleOrDefault(d => d.ServiceType == typeof(DbContextOptions<TicketDbContext>));
                if (existing != null) services.Remove(existing);
                services.AddDbContext<TicketDbContext>(o =>
                    o.UseInMemoryDatabase($"MetricsTestDb_{Guid.NewGuid()}"));
            }));
    }

    [Fact]
    public async Task GetOverview_Returns200_WithExpectedStructure()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/metrics/overview");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        var root = doc.RootElement;

        Assert.True(root.TryGetProperty("totalTickets", out _), "Missing totalTickets");
        Assert.True(root.TryGetProperty("autoResolved", out _), "Missing autoResolved");
        Assert.True(root.TryGetProperty("escalated", out _), "Missing escalated");
        Assert.True(root.TryGetProperty("resolutionRate", out _), "Missing resolutionRate");
        Assert.True(root.TryGetProperty("byCategory", out _), "Missing byCategory");
        Assert.True(root.TryGetProperty("bySeverity", out _), "Missing bySeverity");
    }

    [Fact]
    public async Task GetOverview_EmptyDb_ReturnsZerosAndEmptyMaps()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/metrics/overview");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        var root = doc.RootElement;

        Assert.Equal(0, root.GetProperty("totalTickets").GetInt32());
        Assert.Equal(0, root.GetProperty("autoResolved").GetInt32());
        Assert.Equal(0, root.GetProperty("escalated").GetInt32());
        Assert.Equal(0.0, root.GetProperty("resolutionRate").GetDouble());
    }

    [Fact]
    public async Task GetOverview_AfterSimulation_ReflectsTickets()
    {
        var client = _factory.CreateClient();

        // Run a simulation to create tickets
        var simResponse = await client.PostAsync("/api/simulate?count=10", null);
        Assert.Equal(HttpStatusCode.OK, simResponse.StatusCode);

        var response = await client.GetAsync("/api/metrics/overview");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        var root = doc.RootElement;

        var total = root.GetProperty("totalTickets").GetInt32();
        var autoResolved = root.GetProperty("autoResolved").GetInt32();
        var escalated = root.GetProperty("escalated").GetInt32();
        var rate = root.GetProperty("resolutionRate").GetDouble();

        Assert.Equal(10, total);
        Assert.Equal(total, autoResolved + escalated);
        Assert.InRange(rate, 0.0, 1.0);
    }
}
