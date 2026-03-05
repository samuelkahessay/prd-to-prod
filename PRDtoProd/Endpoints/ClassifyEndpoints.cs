using Microsoft.AspNetCore.Http.HttpResults;
using PRDtoProd.Data;
using PRDtoProd.DTOs;
using PRDtoProd.Services;

namespace PRDtoProd.Endpoints;

public static class ClassifyEndpoints
{
    public static void MapClassifyEndpoints(this WebApplication app)
    {
        app.MapPost("/api/tickets/{id:guid}/classify", ClassifyTicket).RequireRateLimiting("PublicPost");
    }

    private static async Task<Results<Ok<TicketResponse>, NotFound>> ClassifyTicket(
        Guid id, TicketDbContext db, ClassificationService classifier)
    {
        var ticket = await db.Tickets.FindAsync(id);
        if (ticket is null) return TypedResults.NotFound();

        classifier.ClassifyTicket(ticket);
        await db.SaveChangesAsync();

        return TypedResults.Ok(ticket.ToResponse());
    }
}
