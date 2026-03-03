using System.Net;
using Microsoft.AspNetCore.Mvc.Testing;

namespace TicketDeflection.Tests;

public class TicketsPageTests
{
    [Fact]
    public async Task TicketsPage_Returns200()
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

        var response = await client.GetAsync("/tickets");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task TicketsPage_RendersFeedScaffold()
    {
        await using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                TestFactoryExtensions.ReplaceDbWithInMemory(services, $"TestDb_{Guid.NewGuid()}");
            });
        });
        var client = factory.CreateClient();

        var html = await client.GetStringAsync("/tickets");

        Assert.Contains("Ticket Feed", html);
        Assert.Contains("ticket-feed", html);
        Assert.Contains("/api/metrics/tickets", html);
    }
}
