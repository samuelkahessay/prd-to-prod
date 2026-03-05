using PRDtoProd.Models;

namespace PRDtoProd.DTOs;

public record CreateTicketRequest(string Title, string Description, string Source);

public record UpdateTicketRequest(string Title, string Description);

public record TicketResponse(
    Guid Id,
    string Title,
    string Description,
    string Category,
    string Severity,
    string Status,
    string? Resolution,
    string Source,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

public static class TicketExtensions
{
    public static TicketResponse ToResponse(this Ticket t) => new(
        t.Id, t.Title, t.Description,
        t.Category.ToString(), t.Severity.ToString(), t.Status.ToString(),
        t.Resolution, t.Source, t.CreatedAt, t.UpdatedAt
    );
}
