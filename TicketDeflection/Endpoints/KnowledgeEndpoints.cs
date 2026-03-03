using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using TicketDeflection.Data;
using TicketDeflection.DTOs;
using TicketDeflection.Models;

namespace TicketDeflection.Endpoints;

public static class KnowledgeEndpoints
{
    public static void MapKnowledgeEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/knowledge");

        group.MapPost("/", CreateArticle).RequireRateLimiting("PublicPost");
        group.MapGet("/", GetArticles);
        group.MapGet("/{id:guid}", GetArticle);
        group.MapDelete("/{id:guid}", DeleteArticle).RequireAuthorization();
    }

    private static async Task<Results<Created<KnowledgeResponse>, BadRequest>> CreateArticle(
        CreateKnowledgeRequest request, TicketDbContext db)
    {
        if (!Enum.TryParse<TicketCategory>(request.Category, true, out var category))
            return TypedResults.BadRequest();

        var article = new KnowledgeArticle
        {
            Id = Guid.NewGuid(),
            Title = request.Title,
            Content = request.Content,
            Tags = request.Tags,
            Category = category,
            CreatedAt = DateTime.UtcNow
        };

        db.KnowledgeArticles.Add(article);
        await db.SaveChangesAsync();

        return TypedResults.Created($"/api/knowledge/{article.Id}", ToResponse(article));
    }

    private static async Task<Ok<List<KnowledgeResponse>>> GetArticles(
        TicketDbContext db, string? category = null)
    {
        var query = db.KnowledgeArticles.AsQueryable();

        if (category != null && Enum.TryParse<TicketCategory>(category, true, out var c))
            query = query.Where(a => a.Category == c);

        var articles = (await query.ToListAsync()).Select(ToResponse).ToList();
        return TypedResults.Ok(articles);
    }

    private static async Task<Results<Ok<KnowledgeResponse>, NotFound>> GetArticle(
        Guid id, TicketDbContext db)
    {
        var article = await db.KnowledgeArticles.FindAsync(id);
        if (article is null) return TypedResults.NotFound();
        return TypedResults.Ok(ToResponse(article));
    }

    private static async Task<Results<NoContent, NotFound>> DeleteArticle(
        Guid id, TicketDbContext db)
    {
        var article = await db.KnowledgeArticles.FindAsync(id);
        if (article is null) return TypedResults.NotFound();

        db.KnowledgeArticles.Remove(article);
        await db.SaveChangesAsync();

        return TypedResults.NoContent();
    }

    private static KnowledgeResponse ToResponse(KnowledgeArticle a) => new(
        a.Id, a.Title, a.Content, a.Tags, a.Category.ToString()
    );
}
