using Microsoft.AspNetCore.Mvc.Testing;
using System.Net;

namespace TicketDeflection.Tests;

public class CompliancePageTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public CompliancePageTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task CompliancePage_Returns200()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/compliance");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
