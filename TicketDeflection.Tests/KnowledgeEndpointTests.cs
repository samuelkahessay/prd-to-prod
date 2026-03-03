using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using TicketDeflection.Data;

namespace TicketDeflection.Tests;

public class KnowledgeEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;
    private readonly WebApplicationFactory<Program> _factory;

    public KnowledgeEndpointTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory.WithTestAuth();
        _client = _factory.CreateClient();
    }

    [Fact]
    public async Task GetKnowledge_ReturnsOk()
    {
        var response = await _client.GetAsync("/api/knowledge");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task SeedData_Loads12PlusArticles()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TicketDbContext>();
        var count = await db.KnowledgeArticles.CountAsync();
        Assert.True(count >= 12, $"Expected at least 12 articles, got {count}");
    }

    [Fact]
    public async Task SeedData_HasArticlesForAllCategories()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TicketDbContext>();

        var categories = await db.KnowledgeArticles
            .Select(a => a.Category)
            .Distinct()
            .ToListAsync();

        Assert.Contains(TicketDeflection.Models.TicketCategory.Bug, categories);
        Assert.Contains(TicketDeflection.Models.TicketCategory.HowTo, categories);
        Assert.Contains(TicketDeflection.Models.TicketCategory.FeatureRequest, categories);
        Assert.Contains(TicketDeflection.Models.TicketCategory.AccountIssue, categories);
        Assert.Contains(TicketDeflection.Models.TicketCategory.Other, categories);
    }

    [Fact]
    public async Task PostKnowledge_ReturnsCreated()
    {
        var response = await _client.PostAsJsonAsync("/api/knowledge", new
        {
            title = "Test Article",
            content = "Test content",
            tags = "test,article",
            category = "Bug"
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.NotNull(response.Headers.Location);
    }

    [Fact]
    public async Task GetKnowledge_NotFound_Returns404()
    {
        var response = await _client.GetAsync($"/api/knowledge/{Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task DeleteKnowledge_NotFound_Returns404()
    {
        var response = await _client.DeleteAsync($"/api/knowledge/{Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetKnowledge_FilterByCategory_ReturnsFiltered()
    {
        var response = await _client.GetAsync("/api/knowledge?category=Bug");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var articles = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(articles.GetArrayLength() >= 1);
        foreach (var article in articles.EnumerateArray())
            Assert.Equal("Bug", article.GetProperty("category").GetString());
    }

    [Fact]
    public async Task PostThenGetKnowledge_ReturnsArticle()
    {
        var createResp = await _client.PostAsJsonAsync("/api/knowledge", new
        {
            title = "How-to Guide",
            content = "Step by step instructions.",
            tags = "guide,howto",
            category = "HowTo"
        });
        Assert.Equal(HttpStatusCode.Created, createResp.StatusCode);

        var location = createResp.Headers.Location!.ToString();
        var getResp = await _client.GetAsync(location);
        Assert.Equal(HttpStatusCode.OK, getResp.StatusCode);

        var article = await getResp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("How-to Guide", article.GetProperty("title").GetString());
        Assert.Equal("HowTo", article.GetProperty("category").GetString());
    }

    [Fact]
    public async Task DeleteKnowledge_DeletesSuccessfully()
    {
        var createResp = await _client.PostAsJsonAsync("/api/knowledge", new
        {
            title = "Delete me",
            content = "Content to delete",
            tags = "temp",
            category = "Other"
        });
        var location = createResp.Headers.Location!.ToString();

        var deleteResp = await _client.DeleteAsync(location);
        Assert.Equal(HttpStatusCode.NoContent, deleteResp.StatusCode);

        var getResp = await _client.GetAsync(location);
        Assert.Equal(HttpStatusCode.NotFound, getResp.StatusCode);
    }
}
