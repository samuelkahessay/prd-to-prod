using Microsoft.AspNetCore.Mvc.Testing;

namespace TicketDeflection.Tests;

public class NavigationLayoutTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public NavigationLayoutTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task SharedNavigation_RendersDedicatedLinkRowWithDistinctTargets()
    {
        var client = _factory.CreateClient();

        var html = await client.GetStringAsync("/dashboard");

        Assert.Contains("status-bar-brand-row", html);
        Assert.Contains("status-bar-links", html);
        Assert.Contains("href=\"/\"", html);
        Assert.Contains("href=\"/dashboard\"", html);
        Assert.Contains("href=\"/tickets\"", html);
        Assert.Contains("href=\"/activity\"", html);
        Assert.Contains("href=\"/operator\"", html);
        Assert.Contains("href=\"/pipeline\"", html);
        Assert.Contains("href=\"/compliance\"", html);
    }

    [Fact]
    public async Task SharedNavigation_CssPreventsNavLinksFromShrinkingIntoNeighborTargets()
    {
        var client = _factory.CreateClient();

        var css = await client.GetStringAsync("/css/site.css");

        Assert.Contains(".status-bar-links", css);
        Assert.Contains("flex-wrap: wrap;", css);
        Assert.Contains("flex: 0 0 auto;", css);
        Assert.Contains("white-space: nowrap;", css);
    }
}
