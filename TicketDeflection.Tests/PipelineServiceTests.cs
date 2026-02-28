using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using TicketDeflection.Data;
using TicketDeflection.Endpoints;
using TicketDeflection.Models;
using TicketDeflection.Services;

namespace TicketDeflection.Tests;

public class PipelineServiceTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public PipelineServiceTests(WebApplicationFactory<Program> factory)
    {
        var dbName = $"PipelineTestDb_{Guid.NewGuid()}";
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
    public async Task Submit_PasswordReset_AutoResolved_WithActivityLogs()
    {
        var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/tickets/submit", new
        {
            title = "I cannot reset my password",
            description = "I forgot my password and the reset email is not working login account",
            source = "web"
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        var root = doc.RootElement;

        // Ticket should be auto-resolved
        var status = root.GetProperty("ticket").GetProperty("status").GetString();
        Assert.Equal("AutoResolved", status);

        // Activity log should have at least 3 entries
        var logs = root.GetProperty("activityLogs");
        Assert.True(logs.GetArrayLength() >= 3);

        // Verify log contains expected entries
        var logActions = Enumerable.Range(0, logs.GetArrayLength())
            .Select(i => logs[i].GetProperty("action").GetString())
            .ToList();

        Assert.Contains(logActions, a => a == "Ticket Created");
        Assert.Contains(logActions, a => a != null && a.StartsWith("Ticket Classified as"));
        Assert.Contains(logActions, a => a != null && (a.StartsWith("Ticket Matched") || a.StartsWith("Ticket Auto-Resolved")));
    }

    [Fact]
    public async Task Submit_Gibberish_Escalated_WithActivityLogs()
    {
        var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/tickets/submit", new
        {
            title = "xyzzy qwerty zzzz",
            description = "blargh foobar something nonsense",
            source = "api"
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        var root = doc.RootElement;

        // Ticket should be escalated
        var status = root.GetProperty("ticket").GetProperty("status").GetString();
        Assert.Equal("Escalated", status);

        // Activity log should have at least 3 entries
        var logs = root.GetProperty("activityLogs");
        Assert.True(logs.GetArrayLength() >= 3);
    }

    [Fact]
    public async Task Submit_AnyTicket_ActivityLog_HasAtLeastThreeEntries()
    {
        var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/tickets/submit", new
        {
            title = "Some generic issue",
            description = "I need some help",
            source = "email"
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        var logs = doc.RootElement.GetProperty("activityLogs");
        Assert.True(logs.GetArrayLength() >= 3);
    }

    [Fact]
    public async Task Submit_EmptyDescription_ClassifiesAsOtherMedium()
    {
        var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/tickets/submit", new
        {
            title = "Something",
            description = "",
            source = "web"
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        var root = doc.RootElement;

        var category = root.GetProperty("classification").GetProperty("category").GetString();
        var severity = root.GetProperty("classification").GetProperty("severity").GetString();

        Assert.Equal("Other", category);
        Assert.Equal("Medium", severity);
    }
}
