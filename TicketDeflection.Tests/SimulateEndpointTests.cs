using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using TicketDeflection.Data;

namespace TicketDeflection.Tests;

public class SimulateEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public SimulateEndpointTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory.WithWebHostBuilder(b =>
            b.ConfigureServices(services =>
            {
                var existing = services.SingleOrDefault(d => d.ServiceType == typeof(DbContextOptions<TicketDbContext>));
                if (existing != null) services.Remove(existing);
                services.AddDbContext<TicketDbContext>(o =>
                    o.UseInMemoryDatabase($"SimulateTestDb_{Guid.NewGuid()}"));
            }));
    }

    [Fact]
    public async Task Simulate_Count5_Returns5Generated()
    {
        var client = _factory.CreateClient();

        var response = await client.PostAsync("/api/simulate?count=5", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        var root = doc.RootElement;

        Assert.Equal(5, root.GetProperty("generated").GetInt32());

        // autoResolved + escalated == generated
        var autoResolved = root.GetProperty("autoResolved").GetInt32();
        var escalated = root.GetProperty("escalated").GetInt32();
        Assert.Equal(5, autoResolved + escalated);

        // byCategory should be present and sum to 5
        var byCategory = root.GetProperty("byCategory");
        var total = 0;
        foreach (var prop in byCategory.EnumerateObject())
            total += prop.Value.GetInt32();
        Assert.Equal(5, total);
    }

    [Fact]
    public async Task Simulate_DefaultCount_Returns10Generated()
    {
        var client = _factory.CreateClient();

        var response = await client.PostAsync("/api/simulate", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        Assert.Equal(10, doc.RootElement.GetProperty("generated").GetInt32());
    }

    [Fact]
    public async Task Simulate_ExceedsMax_CappedAt100()
    {
        var client = _factory.CreateClient();

        var response = await client.PostAsync("/api/simulate?count=200", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        Assert.Equal(100, doc.RootElement.GetProperty("generated").GetInt32());
    }
}
