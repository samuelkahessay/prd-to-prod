using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using System.Net;
using System.Text.Json;
using TicketDeflection.Data;

namespace TicketDeflection.Tests;

public class TicketFeedEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public TicketFeedEndpointTests(WebApplicationFactory<Program> factory)
    {
        var dbName = $"TicketFeedTestDb_{Guid.NewGuid()}";
        _factory = factory.WithWebHostBuilder(b =>
        {
            b.ConfigureAppConfiguration((_, config) =>
                config.AddInMemoryCollection(new Dictionary<string, string?> { ["DemoSeed:Enabled"] = "false" }));
            b.ConfigureServices(services =>
            {
                TestFactoryExtensions.ReplaceDbWithInMemory(services, dbName);
                services.AddAuthentication(TestAuthHandler.SchemeName)
                    .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(
                        TestAuthHandler.SchemeName, _ => { });
            });
        });
    }

    [Fact]
    public async Task GetTickets_Returns200_WithExpectedStructure()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/metrics/tickets");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        Assert.Equal(JsonValueKind.Array, doc.RootElement.ValueKind);
    }

    [Fact]
    public async Task GetTickets_EmptyDb_ReturnsEmptyArray()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/metrics/tickets");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        Assert.Equal(0, doc.RootElement.GetArrayLength());
    }

    [Fact]
    public async Task GetTickets_RespectsLimitParameter()
    {
        var client = _factory.CreateClient();

        // Create some tickets via simulation
        await client.PostAsync("/api/simulate?count=10", null);

        var response = await client.GetAsync("/api/metrics/tickets?limit=5&offset=0");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        Assert.True(doc.RootElement.GetArrayLength() <= 5);
    }

    [Fact]
    public async Task GetTickets_EachItemHasExpectedFields()
    {
        var client = _factory.CreateClient();

        await client.PostAsync("/api/simulate?count=3", null);

        var response = await client.GetAsync("/api/metrics/tickets?limit=3");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        var arr = doc.RootElement;

        if (arr.GetArrayLength() > 0)
        {
            var first = arr[0];
            Assert.True(first.TryGetProperty("id", out _), "Missing id");
            Assert.True(first.TryGetProperty("title", out _), "Missing title");
            Assert.True(first.TryGetProperty("category", out _), "Missing category");
            Assert.True(first.TryGetProperty("severity", out _), "Missing severity");
            Assert.True(first.TryGetProperty("status", out _), "Missing status");
            Assert.True(first.TryGetProperty("source", out _), "Missing source");
            Assert.True(first.TryGetProperty("createdAt", out _), "Missing createdAt");
        }
    }
}
