using Microsoft.AspNetCore.Mvc.Testing;
using System.Net;

namespace TicketDeflection.Tests;

public class LandingPageTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public LandingPageTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task LandingPage_Returns200()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task LandingPage_ContainsServiceName()
    {
        var client = _factory.CreateClient();
        var html = await client.GetStringAsync("/");
        Assert.Contains("Ticket Deflection Service", html);
    }

    [Fact]
    public async Task LandingPage_ContainsPipelineFlow()
    {
        var client = _factory.CreateClient();
        var html = await client.GetStringAsync("/");
        Assert.Contains("Intake", html);
        Assert.Contains("Classify", html);
        Assert.Contains("Match", html);
        Assert.Contains("Resolve/Escalate", html);
    }

    [Fact]
    public async Task LandingPage_ContainsDashboardLink()
    {
        var client = _factory.CreateClient();
        var html = await client.GetStringAsync("/");
        Assert.Contains("href=\"/dashboard\"", html);
    }

    [Fact]
    public async Task LandingPage_ContainsSingleDashboardCTA()
    {
        var client = _factory.CreateClient();
        var html = await client.GetStringAsync("/");
        // Three-link nav grid replaced with single /dashboard CTA (#252)
        Assert.Contains("href=\"/dashboard\"", html);
        Assert.DoesNotContain("href=\"/activity\"", html);
        Assert.DoesNotContain("href=\"/tickets\"", html);
    }

    [Fact]
    public async Task LandingPage_DoesNotCallSimulateOnLoad()
    {
        var client = _factory.CreateClient();
        var html = await client.GetStringAsync("/");
        // Landing page no longer calls POST /api/simulate (#252)
        Assert.DoesNotContain("Run Demo", html);
        Assert.DoesNotContain("api/simulate", html);
    }

    [Fact]
    public async Task LandingPage_ContainsGetStartedSection()
    {
        var client = _factory.CreateClient();
        var html = await client.GetStringAsync("/");
        Assert.Contains("get started", html);
    }

    [Fact]
    public async Task LandingPage_ContainsFooterWithGhAwLink()
    {
        var client = _factory.CreateClient();
        var html = await client.GetStringAsync("/");
        Assert.Contains("github.com/github/gh-aw", html);
    }

    [Fact]
    public async Task ShowcaseTimeline_Returns200ForValidSlug()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/showcase/01-code-snippet-manager/timeline");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadAsStringAsync();
        Assert.Contains("timeline", json);
    }

    [Fact]
    public async Task ShowcaseTimeline_Returns404ForUnknownSlug()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/showcase/nonexistent/timeline");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
