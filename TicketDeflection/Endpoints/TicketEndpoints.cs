using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using TicketDeflection.Data;
using TicketDeflection.DTOs;
using TicketDeflection.Models;

namespace TicketDeflection.Endpoints;

public static class TicketEndpoints
{
    public static void MapTicketEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/tickets");

        group.MapPost("/", CreateTicket);
        group.MapGet("/", GetTickets);
        group.MapGet("/{id:guid}", GetTicket);
        group.MapPut("/{id:guid}", UpdateTicket);
        group.MapDelete("/{id:guid}", DeleteTicket);
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

        return TypedResults.Created($"/api/tickets/{ticket.Id}", ToResponse(ticket));
    }

    private static async Task<Ok<List<TicketResponse>>> GetTickets(
        TicketDbContext db, string? status = null, string? category = null)
    {
        var query = db.Tickets.AsQueryable();

        if (status != null && Enum.TryParse<TicketStatus>(status, true, out var s))
            query = query.Where(t => t.Status == s);

        if (category != null && Enum.TryParse<TicketCategory>(category, true, out var c))
            query = query.Where(t => t.Category == c);

        var tickets = (await query.ToListAsync()).Select(ToResponse).ToList();
        return TypedResults.Ok(tickets);
    }

    private static async Task<Results<Ok<TicketResponse>, NotFound>> GetTicket(
        Guid id, TicketDbContext db)
    {
        var ticket = await db.Tickets.FindAsync(id);
        if (ticket is null) return TypedResults.NotFound();
        return TypedResults.Ok(ToResponse(ticket));
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

        return TypedResults.Ok(ToResponse(ticket));
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

    private static TicketResponse ToResponse(Ticket t) => new(
        t.Id, t.Title, t.Description,
        t.Category.ToString(), t.Severity.ToString(), t.Status.ToString(),
        t.Resolution, t.Source, t.CreatedAt, t.UpdatedAt
    );
}
