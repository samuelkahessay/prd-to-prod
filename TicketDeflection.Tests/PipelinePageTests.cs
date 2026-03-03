using System.Net;
using Microsoft.AspNetCore.Mvc.Testing;

namespace TicketDeflection.Tests;

public class PipelinePageTests
{
    [Fact]
    public async Task PipelinePage_Returns200()
    {
        await using var factory = new WebApplicationFactory<Program>();
        var client = factory.CreateClient();

        var response = await client.GetAsync("/pipeline");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task PipelinePage_RendersLiveSnapshotScaffold()
    {
        await using var factory = new WebApplicationFactory<Program>();
        var client = factory.CreateClient();

        var html = await client.GetStringAsync("/pipeline");

        Assert.Contains("Pipeline", html);
        Assert.Contains("/api/pipeline/live", html);
        Assert.Contains("Current pipeline flow", html);
        Assert.Contains("/api/showcase/runs", html);
    }
}
