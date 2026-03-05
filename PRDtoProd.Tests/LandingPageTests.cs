using Microsoft.AspNetCore.Mvc.Testing;
using System.Net;
using System.Text.Json;

namespace PRDtoProd.Tests;

public class LandingPageTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public LandingPageTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory.WithTestAuth();
    }

    [Fact]
    public async Task LandingPage_Returns200()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task LandingPage_DoesNotCallSimulateOnLoad()
    {
        var client = _factory.CreateClient();
        var html = await client.GetStringAsync("/");
        Assert.DoesNotContain("Run Demo", html);
        Assert.DoesNotContain("api/simulate", html);
    }

    [Fact]
    public async Task LandingPage_ContainsBoundedAutonomyNarrative()
    {
        var client = _factory.CreateClient();
        var html = await client.GetStringAsync("/");
        Assert.Contains("autonomous delivery pipeline", html);
    }

    [Fact]
    public async Task LandingPage_ContainsPipelineLink()
    {
        var client = _factory.CreateClient();
        var html = await client.GetStringAsync("/");
        Assert.Contains("href=\"/pipeline\"", html);
    }

    [Fact]
    public async Task LandingPage_ContainsFooterWithGhAwLink()
    {
        var client = _factory.CreateClient();
        var html = await client.GetStringAsync("/");
        Assert.Contains("gh-aw", html);
    }

    [Fact]
    public async Task LandingPage_ContainsMeetingToMainCallout()
    {
        var client = _factory.CreateClient();
        var html = await client.GetStringAsync("/");
        Assert.Contains("meeting-to-main", html);
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
    public async Task ShowcaseTimeline_IncludesPullRequestDiffMetadata()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/showcase/01-code-snippet-manager/timeline");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var json = await response.Content.ReadAsStringAsync();
        using var document = JsonDocument.Parse(json);
        var pullRequests = document.RootElement.GetProperty("pull_requests");

        Assert.True(pullRequests.GetArrayLength() > 0);
        Assert.True(pullRequests[0].GetProperty("additions").GetInt32() > 0);
        Assert.True(pullRequests[0].GetProperty("changed_files").GetInt32() > 0);
    }

    [Fact]
    public async Task ShowcaseTimeline_Returns404ForUnknownSlug()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/showcase/nonexistent/timeline");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task ShowcaseRuns_ReturnNewestFirst()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/showcase/runs");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var json = await response.Content.ReadAsStringAsync();
        using var document = JsonDocument.Parse(json);
        var numbers = document.RootElement
            .EnumerateArray()
            .Select(item => item.GetProperty("number").GetInt32())
            .ToArray();

        Assert.Equal(numbers.OrderByDescending(n => n), numbers);
    }
}
