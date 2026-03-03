using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;

namespace TicketDeflection.Tests;

public class TicketEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public TicketEndpointTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.WithTestAuth().CreateClient();
    }

    [Fact]
    public async Task POST_Ticket_Returns201WithLocation()
    {
        var request = new { Title = "Login fails", Description = "Users cannot log in", Source = "web" };
        var response = await _client.PostAsJsonAsync("/api/tickets", request);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.NotNull(response.Headers.Location);
    }

    [Fact]
    public async Task POST_Ticket_SetsStatusNew()
    {
        var request = new { Title = "Test ticket", Description = "Desc", Source = "api" };
        var response = await _client.PostAsJsonAsync("/api/tickets", request);
        var body = await response.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();

        Assert.Equal("New", body.GetProperty("status").GetString());
    }

    [Fact]
    public async Task GET_Tickets_Returns200WithList()
    {
        var response = await _client.GetAsync("/api/tickets");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task GET_Ticket_Returns200ForExisting()
    {
        var createRequest = new { Title = "Find me", Description = "Desc", Source = "test" };
        var created = await _client.PostAsJsonAsync("/api/tickets", createRequest);
        var body = await created.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        var id = body.GetProperty("id").GetString();

        var response = await _client.GetAsync($"/api/tickets/{id}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task GET_Ticket_Returns404ForUnknown()
    {
        var response = await _client.GetAsync($"/api/tickets/{Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task PUT_Ticket_Returns200WithUpdatedData()
    {
        var createRequest = new { Title = "Original", Description = "Old desc", Source = "test" };
        var created = await _client.PostAsJsonAsync("/api/tickets", createRequest);
        var body = await created.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        var id = body.GetProperty("id").GetString();

        var updateRequest = new { Title = "Updated", Description = "New desc" };
        var response = await _client.PutAsJsonAsync($"/api/tickets/{id}", updateRequest);
        var updated = await response.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Updated", updated.GetProperty("title").GetString());
    }

    [Fact]
    public async Task PUT_Ticket_Returns404ForUnknown()
    {
        var updateRequest = new { Title = "Updated", Description = "New desc" };
        var response = await _client.PutAsJsonAsync($"/api/tickets/{Guid.NewGuid()}", updateRequest);
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task DELETE_Ticket_Returns204()
    {
        var createRequest = new { Title = "Delete me", Description = "Desc", Source = "test" };
        var created = await _client.PostAsJsonAsync("/api/tickets", createRequest);
        var body = await created.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        var id = body.GetProperty("id").GetString();

        var response = await _client.DeleteAsync($"/api/tickets/{id}");
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task DELETE_Ticket_Returns404ForUnknown()
    {
        var response = await _client.DeleteAsync($"/api/tickets/{Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
