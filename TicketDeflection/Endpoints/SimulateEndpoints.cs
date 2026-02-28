using TicketDeflection.Data;
using TicketDeflection.Services;

namespace TicketDeflection.Endpoints;

public static class SimulateEndpoints
{
    private static readonly (string Title, string Description, string Source)[] SampleTickets =
    [
        // Bug category (5 templates)
        ("Application crashes on login", "The app throws a NullReferenceException when I try to log in with my Google account", "web"),
        ("Data not saving after edit", "I edit my profile but after refreshing the page, changes are lost and nothing gets saved", "api"),
        ("Export button not working", "Clicking the CSV export button does nothing — no download starts and no error appears", "email"),
        ("Search returns wrong results", "When I search for 'invoice 2024' the results show completely unrelated documents", "web"),
        ("Dark mode toggle broken", "Switching to dark mode causes the page to go blank — requires hard refresh to recover", "api"),
        // HowTo category (5 templates)
        ("How to reset my password", "I forgot my password and the reset email never arrived. How do I regain access to my account?", "web"),
        ("How to export my data", "I need to download all my tickets and activity history as a CSV file for compliance reporting", "email"),
        ("How to invite team members", "I want to add three colleagues to my workspace but cannot find the invite option in settings", "web"),
        ("How to set up two-factor authentication", "I want to enable 2FA on my account for extra security but the setup wizard is confusing", "api"),
        ("How to change notification settings", "I receive too many emails and want to reduce alerts to only critical issues", "email"),
        // FeatureRequest category (5 templates)
        ("Add bulk ticket assignment", "It would save time if we could select multiple open tickets and assign them to an agent at once", "web"),
        ("Support dark mode in mobile app", "Many of us use the app at night and a dark theme would reduce eye strain significantly", "api"),
        ("Add Slack integration for alerts", "We use Slack for all team communication and would love to get ticket alerts there", "email"),
        ("Export metrics as PDF report", "Management requests monthly PDF summaries of resolution rates and ticket volumes", "web"),
        ("Add ticket priority escalation rules", "Auto-escalate tickets that remain unresolved for more than 48 hours to high priority", "api"),
        // AccountIssue category (5 templates)
        ("Cannot access my account after password change", "I changed my password yesterday and now login fails even with the new credentials", "email"),
        ("Subscription not activating", "I upgraded to Pro plan and was charged but my account still shows the free tier limitations", "web"),
        ("Account locked after failed logins", "I got locked out after 5 wrong attempts during a browser autofill issue — need unlock help", "api"),
        ("Two-factor code not accepted", "The authenticator app generates a code but the system keeps saying it is invalid", "email"),
        ("Billing address not updating", "Every time I save a new billing address, the old one reappears — the update never persists", "web"),
        // Other category (4 templates)
        ("Feedback on the new UI", "I like the new dashboard design but the font size in the sidebar feels too small on 1080p", "web"),
        ("Question about data retention policy", "How long does the system keep closed ticket records before archiving or deleting them?", "email"),
        ("General inquiry about integrations", "Do you support integration with Zendesk or Freshdesk for bi-directional ticket sync?", "api"),
        ("Suggestion for documentation", "The API documentation is missing examples for the bulk update endpoint — would help a lot", "web"),
    ];

    public static void MapSimulateEndpoints(this WebApplication app)
    {
        app.MapPost("/api/simulate", RunSimulation);
    }

    private static async Task<IResult> RunSimulation(
        TicketDbContext db, PipelineService pipeline, int count = 10)
    {
        if (count < 1) count = 1;
        if (count > 100) count = 100;

        var autoResolved = 0;
        var escalated = 0;
        var byCategory = new Dictionary<string, int>();

        var random = new Random();
        for (var i = 0; i < count; i++)
        {
            var template = SampleTickets[random.Next(SampleTickets.Length)];
            var result = await pipeline.ProcessTicket(
                template.Title, template.Description, template.Source, db);

            if (result.Ticket.Status == TicketDeflection.Models.TicketStatus.AutoResolved)
                autoResolved++;
            else
                escalated++;

            var cat = result.Category;
            byCategory[cat] = byCategory.GetValueOrDefault(cat) + 1;
        }

        return Results.Ok(new SimulationSummary(count, autoResolved, escalated, byCategory));
    }
}

public record SimulationSummary(int Generated, int AutoResolved, int Escalated, Dictionary<string, int> ByCategory);
