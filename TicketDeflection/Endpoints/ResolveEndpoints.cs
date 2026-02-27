using Microsoft.AspNetCore.Http.HttpResults;
using TicketDeflection.Data;
using TicketDeflection.DTOs;
using TicketDeflection.Models;
using TicketDeflection.Services;

namespace TicketDeflection.Endpoints;

public static class ResolveEndpoints
{
    public static void MapResolveEndpoints(this WebApplication app)
    {
        app.MapPost("/api/tickets/{id:guid}/resolve", ResolveTicket);
    }

    private static async Task<Results<Ok<ResolveResponse>, NotFound>> ResolveTicket(
        Guid id, TicketDbContext db, MatchingService matcher)
    {
        var ticket = await db.Tickets.FindAsync(id);
        if (ticket is null) return TypedResults.NotFound();

        // Load articles for matching
        matcher.ResolveTicket(ticket, db);
        await db.SaveChangesAsync();

        // Compute confidence scores for response
        var articles = db.KnowledgeArticles.ToList();
        var ticketTokens = Tokenize($"{ticket.Title} {ticket.Description}");
        var matches = articles
            .Select(a => new ArticleMatch(
                a.Id, a.Title,
                Jaccard(ticketTokens, Tokenize($"{a.Content} {a.Tags}"))))
            .Where(m => m.Score > 0)
            .OrderByDescending(m => m.Score)
            .Take(3)
            .ToList();

        var ticketResponse = new TicketResponse(
            ticket.Id, ticket.Title, ticket.Description,
            ticket.Category.ToString(), ticket.Severity.ToString(), ticket.Status.ToString(),
            ticket.Resolution, ticket.Source, ticket.CreatedAt, ticket.UpdatedAt
        );

        return TypedResults.Ok(new ResolveResponse(ticketResponse, matches));
    }

    private static HashSet<string> Tokenize(string text) =>
        text.Split([' ', '\t', ',', '\n', '\r'], StringSplitOptions.RemoveEmptyEntries)
            .Select(t => t.ToLowerInvariant())
            .ToHashSet();

    private static double Jaccard(HashSet<string> a, HashSet<string> b)
    {
        if (a.Count == 0 && b.Count == 0) return 0;
        var intersection = a.Intersect(b).Count();
        var union = a.Union(b).Count();
        return intersection / (double)union;
    }
}

public record ArticleMatch(Guid ArticleId, string Title, double Score);
public record ResolveResponse(TicketResponse Ticket, List<ArticleMatch> Matches);
