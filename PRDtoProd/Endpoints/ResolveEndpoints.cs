using Microsoft.AspNetCore.Http.HttpResults;
using PRDtoProd.Data;
using PRDtoProd.DTOs;
using PRDtoProd.Models;
using PRDtoProd.Services;

namespace PRDtoProd.Endpoints;

public static class ResolveEndpoints
{
    public static void MapResolveEndpoints(this WebApplication app)
    {
        app.MapPost("/api/tickets/{id:guid}/resolve", ResolveTicket).RequireRateLimiting("PublicPost");
    }

    private static async Task<Results<Ok<ResolveResponse>, NotFound>> ResolveTicket(
        Guid id, TicketDbContext db, MatchingService matcher)
    {
        var ticket = await db.Tickets.FindAsync(id);
        if (ticket is null) return TypedResults.NotFound();

        // Resolve the ticket (sets Status and Resolution)
        matcher.ResolveTicket(ticket, db);
        await db.SaveChangesAsync();

        // Compute confidence scores for response via the service layer
        var articles = db.KnowledgeArticles.ToList();
        var matches = matcher.GetTopMatches(ticket, articles).ToList();

        var ticketResponse = ticket.ToResponse();

        return TypedResults.Ok(new ResolveResponse(ticketResponse, matches));
    }
}
