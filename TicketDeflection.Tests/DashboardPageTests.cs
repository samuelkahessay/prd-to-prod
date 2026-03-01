using Microsoft.AspNetCore.Mvc.Testing;
using System.Net;

namespace TicketDeflection.Tests;

public class DashboardPageTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public DashboardPageTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Dashboard_Returns200()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/dashboard");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Dashboard_ContainsSubmitButton()
    {
        var client = _factory.CreateClient();
        var html = await client.GetStringAsync("/dashboard");
        Assert.Contains("submitTicket()", html);
    }

    [Fact]
    public async Task Dashboard_ContainsRandomButton()
    {
        var client = _factory.CreateClient();
        var html = await client.GetStringAsync("/dashboard");
        Assert.Contains("fillRandom()", html);
        Assert.Contains("[ random ]", html);
    }

    [Fact]
    public async Task Dashboard_RandomButtonHasSampleTickets()
    {
        var client = _factory.CreateClient();
        var html = await client.GetStringAsync("/dashboard");
        Assert.Contains("SAMPLE_TICKETS", html);
    }

    [Fact]
    public async Task Dashboard_AutoFillDelayConfigured()
    {
        var client = _factory.CreateClient();
        var html = await client.GetStringAsync("/dashboard");
        // auto-submit after 300ms pause
        Assert.Contains("setTimeout(submitTicket, 300)", html);
    }
}
