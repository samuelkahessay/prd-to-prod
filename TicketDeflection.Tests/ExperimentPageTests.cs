using Microsoft.AspNetCore.Mvc.Testing;

namespace TicketDeflection.Tests;

public class ExperimentPageTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public ExperimentPageTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory.WithTestAuth();
    }

    [Fact]
    public async Task ExperimentPage_Returns200()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/experiment");
        Assert.Equal(System.Net.HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task ExperimentPage_ContainsGalleryGrid()
    {
        var client = _factory.CreateClient();
        var html = await client.GetStringAsync("/experiment");
        Assert.Contains("gallery-grid", html);
        Assert.Contains("gallery-item", html);
    }

    [Fact]
    public async Task ExperimentPage_ContainsUnsplashImages()
    {
        var client = _factory.CreateClient();
        var html = await client.GetStringAsync("/experiment");
        Assert.Contains("images.unsplash.com", html);
        Assert.Contains("unsplash.com/photos/", html);
    }

    [Fact]
    public async Task ExperimentPage_RendersAllTwelvePhotos()
    {
        var client = _factory.CreateClient();
        var html = await client.GetStringAsync("/experiment");
        Assert.Contains("12 frames", html);
        // Verify first and last photo IDs are present
        Assert.Contains("1518770660439-4636190af475", html);
        Assert.Contains("1534972195531-d236914a371a", html);
    }

    [Fact]
    public async Task ExperimentPage_IsLinkedFromNavigation()
    {
        var client = _factory.CreateClient();
        var html = await client.GetStringAsync("/");
        Assert.Contains("href=\"/experiment\"", html);
    }
}
