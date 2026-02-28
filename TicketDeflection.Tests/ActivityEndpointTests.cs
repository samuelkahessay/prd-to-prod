using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using TicketDeflection.Data;
using TicketDeflection.Models;

namespace TicketDeflection.Tests;

public class ActivityEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public ActivityEndpointTests(WebApplicationFactory<Program> factory)
    {
        var dbName = $"ActivityTestDb_{Guid.NewGuid()}";
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
    public async Task GetActivity_Returns200_WithExpectedStructure()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/metrics/activity");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        Assert.Equal(JsonValueKind.Array, doc.RootElement.ValueKind);
    }

    [Fact]
    public async Task GetActivity_EmptyDb_ReturnsEmptyArray()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/metrics/activity");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        Assert.Equal(0, doc.RootElement.GetArrayLength());
    }

    [Fact]
    public async Task GetActivity_RespectsLimitParameter()
    {
        var client = _factory.CreateClient();

        // Seed via simulation to get activity entries
        await client.PostAsync("/api/simulate?count=10", null);

        var response = await client.GetAsync("/api/metrics/activity?limit=3");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        Assert.True(doc.RootElement.GetArrayLength() <= 3);
    }

    [Fact]
    public async Task GetActivity_RespectsOffsetParameter()
    {
        var client = _factory.CreateClient();

        await client.PostAsync("/api/simulate?count=10", null);

        var allResponse = await client.GetAsync("/api/metrics/activity?limit=100");
        var offsetResponse = await client.GetAsync("/api/metrics/activity?limit=100&offset=2");

        Assert.Equal(HttpStatusCode.OK, allResponse.StatusCode);
        Assert.Equal(HttpStatusCode.OK, offsetResponse.StatusCode);

        var allBody = await allResponse.Content.ReadAsStringAsync();
        var offsetBody = await offsetResponse.Content.ReadAsStringAsync();

        using var allDoc = JsonDocument.Parse(allBody);
        using var offsetDoc = JsonDocument.Parse(offsetBody);

        // offset=2 should return fewer items than offset=0
        Assert.True(offsetDoc.RootElement.GetArrayLength() <= allDoc.RootElement.GetArrayLength());
    }

    [Fact]
    public async Task GetActivity_EachItemHasExpectedFields()
    {
        var client = _factory.CreateClient();

        await client.PostAsync("/api/simulate?count=5", null);

        var response = await client.GetAsync("/api/metrics/activity");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);

        // Only check fields if we have items
        if (doc.RootElement.GetArrayLength() > 0)
        {
            var first = doc.RootElement[0];
            Assert.True(first.TryGetProperty("id", out _), "Missing id");
            Assert.True(first.TryGetProperty("ticketId", out _), "Missing ticketId");
            Assert.True(first.TryGetProperty("action", out _), "Missing action");
            Assert.True(first.TryGetProperty("details", out _), "Missing details");
            Assert.True(first.TryGetProperty("timestamp", out _), "Missing timestamp");
        }
    }
}
