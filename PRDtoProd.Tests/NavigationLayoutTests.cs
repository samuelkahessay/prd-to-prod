using Microsoft.AspNetCore.Mvc.Testing;

namespace PRDtoProd.Tests;

public class NavigationLayoutTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public NavigationLayoutTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory.WithTestAuth();
    }

    [Fact]
    public async Task SharedNavigation_RendersDedicatedLinkRowWithDistinctTargets()
    {
        var client = _factory.CreateClient();

        var html = await client.GetStringAsync("/");

        Assert.Contains("status-bar-brand-row", html);
        Assert.Contains("status-bar-links", html);
        Assert.Contains("href=\"/pipeline\"", html);
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
