using Microsoft.AspNetCore.Mvc.Testing;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace TicketDeflection.Tests;

public class TicketEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public TicketEndpointTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task PostTicket_ReturnsCreated()
    {
        var response = await _client.PostAsJsonAsync("/api/tickets", new
        {
            title = "Test ticket",
            description = "Some description",
            source = "web"
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.NotNull(response.Headers.Location);
    }

    [Fact]
    public async Task GetTickets_ReturnsOk()
    {
        var response = await _client.GetAsync("/api/tickets");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task GetTicket_NotFound_Returns404()
    {
        var response = await _client.GetAsync($"/api/tickets/{Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task PutTicket_NotFound_Returns404()
    {
        var response = await _client.PutAsJsonAsync($"/api/tickets/{Guid.NewGuid()}", new
        {
            title = "Updated",
            description = "Updated desc"
        });
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task DeleteTicket_NotFound_Returns404()
    {
        var response = await _client.DeleteAsync($"/api/tickets/{Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task PostThenGet_ReturnsTicketWithNewStatus()
    {
        var createResp = await _client.PostAsJsonAsync("/api/tickets", new
        {
            title = "CRUD test",
            description = "Description",
            source = "api"
        });
        Assert.Equal(HttpStatusCode.Created, createResp.StatusCode);

        var location = createResp.Headers.Location!.ToString();
        var getResp = await _client.GetAsync(location);
        Assert.Equal(HttpStatusCode.OK, getResp.StatusCode);

        var ticket = await getResp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("CRUD test", ticket.GetProperty("title").GetString());
        Assert.Equal("New", ticket.GetProperty("status").GetString());
    }

    [Fact]
    public async Task PutTicket_UpdatesSuccessfully()
    {
        var createResp = await _client.PostAsJsonAsync("/api/tickets", new
        {
            title = "Original",
            description = "Original desc",
            source = "api"
        });
        var location = createResp.Headers.Location!.ToString();

        var putResp = await _client.PutAsJsonAsync(location, new
        {
            title = "Updated Title",
            description = "Updated desc"
        });
        Assert.Equal(HttpStatusCode.OK, putResp.StatusCode);

        var updated = await putResp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Updated Title", updated.GetProperty("title").GetString());
    }

    [Fact]
    public async Task DeleteTicket_DeletesSuccessfully()
    {
        var createResp = await _client.PostAsJsonAsync("/api/tickets", new
        {
            title = "Delete me",
            description = "Test",
            source = "api"
        });
        var location = createResp.Headers.Location!.ToString();

        var deleteResp = await _client.DeleteAsync(location);
        Assert.Equal(HttpStatusCode.NoContent, deleteResp.StatusCode);

        var getResp = await _client.GetAsync(location);
        Assert.Equal(HttpStatusCode.NotFound, getResp.StatusCode);
    }

    [Fact]
    public async Task GetTickets_FilterByStatus_ReturnsFiltered()
    {
        await _client.PostAsJsonAsync("/api/tickets", new
        {
            title = "Filtered ticket",
            description = "Desc",
            source = "api"
        });

        var response = await _client.GetAsync("/api/tickets?status=New");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var tickets = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(tickets.GetArrayLength() >= 1);
    }
}
