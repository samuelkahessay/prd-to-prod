using System.Net;
using Microsoft.AspNetCore.Mvc.Testing;

namespace TicketDeflection.Tests;

public class ActivityPageTests
{
    [Fact]
    public async Task ActivityPage_Returns200()
    {
        await using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                TestFactoryExtensions.ReplaceDbWithInMemory(services, $"TestDb_{Guid.NewGuid()}");
            });
        });
        var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false
        });

        var response = await client.GetAsync("/activity");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task ActivityPage_RendersTimelineScaffold()
    {
        await using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                TestFactoryExtensions.ReplaceDbWithInMemory(services, $"TestDb_{Guid.NewGuid()}");
            });
        });
        var client = factory.CreateClient();

        var html = await client.GetStringAsync("/activity");

        Assert.Contains("Activity Log", html);
        Assert.Contains("activity-timeline", html);
        Assert.Contains("/api/metrics/activity", html);
    }
}
