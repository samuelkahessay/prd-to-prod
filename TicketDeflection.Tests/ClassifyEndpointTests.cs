using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using TicketDeflection.Data;
using TicketDeflection.Models;

namespace TicketDeflection.Tests;

public class ClassifyEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;
    private readonly WebApplicationFactory<Program> _factory;

    public ClassifyEndpointTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory.WithTestAuth();
        _client = _factory.CreateClient();
    }

    private async Task<Guid> CreateTicketInDb(string title, string description = "desc")
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TicketDbContext>();
        var ticket = new Ticket { Title = title, Description = description, Source = "test" };
        db.Tickets.Add(ticket);
        await db.SaveChangesAsync();
        return ticket.Id;
    }

    [Fact]
    public async Task Classify_ExistingTicket_Returns200WithClassifiedStatus()
    {
        var id = await CreateTicketInDb("App crash on login");
        var response = await _client.PostAsync($"/api/tickets/{id}/classify", null);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var ticket = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Classified", ticket.GetProperty("status").GetString());
        Assert.Equal("Bug", ticket.GetProperty("category").GetString());
        Assert.Equal("High", ticket.GetProperty("severity").GetString());
    }

    [Fact]
    public async Task Classify_NonExistentTicket_Returns404()
    {
        var response = await _client.PostAsync($"/api/tickets/{Guid.NewGuid()}/classify", null);
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
