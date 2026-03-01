using TicketDeflection.Models;

namespace TicketDeflection.Services;

public class ClassificationService
{
    private static readonly (string[] Keywords, TicketCategory Category)[] Rules =
    [
        (["crash", "error", "broken", "bug", "exception"], TicketCategory.Bug),
        (["how do i", "how to", "help with", "guide"], TicketCategory.HowTo),
        (["add feature", "request", "wish", "would be nice"], TicketCategory.FeatureRequest),
        (["login", "password", "account", "billing", "subscription"], TicketCategory.AccountIssue),
    ];

    private static readonly Dictionary<TicketCategory, TicketSeverity> SeverityMap = new()
    {
        [TicketCategory.Bug] = TicketSeverity.High,
        [TicketCategory.HowTo] = TicketSeverity.Low,
        [TicketCategory.FeatureRequest] = TicketSeverity.Medium,
        [TicketCategory.AccountIssue] = TicketSeverity.Medium,
        [TicketCategory.Other] = TicketSeverity.Medium,
    };

    public void ClassifyTicket(Ticket ticket)
    {
        var text = $"{ticket.Title} {ticket.Description}";
        var category = TicketCategory.Other;

        foreach (var (keywords, cat) in Rules)
        {
            if (keywords.Any(k => text.Contains(k, StringComparison.OrdinalIgnoreCase)))
            {
                category = cat;
                break;
            }
        }

        ticket.Category = category;
        ticket.Severity = SeverityMap[category];
        ticket.Status = TicketStatus.Classified;
    }
}