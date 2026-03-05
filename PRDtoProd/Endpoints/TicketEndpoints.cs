using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PRDtoProd.Data;
using PRDtoProd.DTOs;
using PRDtoProd.Models;

namespace PRDtoProd.Endpoints;

public static class TicketEndpoints
{
    public static void MapTicketEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/tickets");

        group.MapPost("/", CreateTicket).RequireRateLimiting("PublicPost");
        group.MapGet("/", GetTickets);
        group.MapGet("/{id:guid}", GetTicket);
        group.MapPut("/{id:guid}", UpdateTicket).RequireAuthorization();
        group.MapDelete("/{id:guid}", DeleteTicket).RequireAuthorization();
    }

    private static async Task<Results<Created<TicketResponse>, BadRequest>> CreateTicket(
        CreateTicketRequest request, TicketDbContext db)
    {
        var ticket = new Ticket
        {
            Id = Guid.NewGuid(),
            Title = request.Title,
            Description = request.Description,
            Source = request.Source,
            Status = TicketStatus.New,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        db.Tickets.Add(ticket);
        await db.SaveChangesAsync();

        var response = ticket.ToResponse();
        return TypedResults.Created($"/api/tickets/{ticket.Id}", response);
    }

    private static async Task<Ok<List<TicketResponse>>> GetTickets(
        TicketDbContext db, string? status = null, string? category = null)
    {
        var query = db.Tickets.AsQueryable();

        if (status is not null && Enum.TryParse<TicketStatus>(status, true, out var statusEnum))
            query = query.Where(t => t.Status == statusEnum);

        if (category is not null && Enum.TryParse<TicketCategory>(category, true, out var categoryEnum))
            query = query.Where(t => t.Category == categoryEnum);

        var tickets = await query.Select(t => t.ToResponse()).ToListAsync();
        return TypedResults.Ok(tickets);
    }

    private static async Task<Results<Ok<TicketResponse>, NotFound>> GetTicket(
        Guid id, TicketDbContext db)
    {
        var ticket = await db.Tickets.FindAsync(id);
        return ticket is null
            ? TypedResults.NotFound()
            : TypedResults.Ok(ticket.ToResponse());
    }

    private static async Task<Results<Ok<TicketResponse>, NotFound>> UpdateTicket(
        Guid id, UpdateTicketRequest request, TicketDbContext db)
    {
        var ticket = await db.Tickets.FindAsync(id);
        if (ticket is null) return TypedResults.NotFound();

        ticket.Title = request.Title;
        ticket.Description = request.Description;
        ticket.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();
        return TypedResults.Ok(ticket.ToResponse());
    }

    private static async Task<Results<NoContent, NotFound>> DeleteTicket(
        Guid id, TicketDbContext db)
    {
        var ticket = await db.Tickets.FindAsync(id);
        if (ticket is null) return TypedResults.NotFound();

        db.Tickets.Remove(ticket);
        await db.SaveChangesAsync();
        return TypedResults.NoContent();
    }

}
