namespace PRDtoProd.DTOs;

public record ArticleMatch(Guid ArticleId, string Title, double Score);
public record ResolveResponse(TicketResponse Ticket, IReadOnlyList<ArticleMatch> Matches);
