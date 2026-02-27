namespace TicketDeflection.DTOs;

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
