using System.Net;
using Microsoft.AspNetCore.Mvc.Testing;

namespace TicketDeflection.Tests;

public class PipelinePageTests
{
    [Fact]
    public async Task PipelinePage_Returns200()
    {
        await using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                TestFactoryExtensions.ReplaceDbWithInMemory(services, $"TestDb_{Guid.NewGuid()}");
            });
        });
        var client = factory.CreateClient();

        var response = await client.GetAsync("/pipeline");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task PipelinePage_RendersLiveSnapshotScaffold()
    {
        await using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                TestFactoryExtensions.ReplaceDbWithInMemory(services, $"TestDb_{Guid.NewGuid()}");
            });
        });
        var client = factory.CreateClient();

        var html = await client.GetStringAsync("/pipeline");

        Assert.Contains("Pipeline", html);
        Assert.Contains("/api/pipeline/live", html);
        Assert.Contains("Current pipeline flow", html);
        Assert.Contains("/api/showcase/runs", html);
    }

    [Fact]
    public async Task PipelinePage_UsesSnapshotCiStateLiteralsInMergeGateLogic()
    {
        await using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                TestFactoryExtensions.ReplaceDbWithInMemory(services, $"TestDb_{Guid.NewGuid()}");
            });
        });
        var client = factory.CreateClient();

        var html = await client.GetStringAsync("/pipeline");

        Assert.Contains("pr.ciState === 'passed'", html);
        Assert.Contains("pr.ciState === 'failed'", html);
        Assert.DoesNotContain("pr.ciState === 'passing'", html);
        Assert.DoesNotContain("pr.ciState === 'failing'", html);
        Assert.Contains("const repairStages = ['repair_requested', 'incident_open'];", html);
        Assert.DoesNotContain("const repairStages = ['ci_repair'", html);
    }

    [Fact]
    public async Task PipelinePage_KeepsReplayEventLogHeightStable()
    {
        await using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                TestFactoryExtensions.ReplaceDbWithInMemory(services, $"TestDb_{Guid.NewGuid()}");
            });
        });
        var client = factory.CreateClient();

        var html = await client.GetStringAsync("/pipeline");

        Assert.Contains(".event-log {", html);
        Assert.Contains("height: 24rem;", html);
        Assert.Contains("overflow-anchor: none;", html);
        Assert.Contains("id=\"eventLog\" class=\"event-log text-sm\"", html);
        Assert.DoesNotContain("scrollIntoView({ block: 'nearest', behavior: 'smooth' })", html);
    }
}
