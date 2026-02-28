using TicketDeflection.Data;
using TicketDeflection.Services;

namespace TicketDeflection.Endpoints;

public static class SimulateEndpoints
{
    internal static readonly (string Title, string Description, string Source)[] SampleTickets =
    [
        // Bug category (5 templates — 4 match KB articles, 1 miss)
        ("Error 500 on the server", "I keep getting an error 500 internal server error when loading the main page. The error appears on every request to the server.", "web"),
        ("Application crashes after restart", "The application crashes immediately after restart. I checked the logs in the service manager but could not find details about the crash recovery steps.", "api"),
        ("Export button gives no response", "I navigate to settings and click the export button but the CSV format download never starts. Tried JSON format export too.", "email"),
        ("Error 403 forbidden access on the server", "When I try to access the admin panel I get an error 403 forbidden. The server returns a forbidden access error on every request.", "web"),
        ("Search returns wrong results", "When I search for recent orders the results show completely unrelated documents from other users.", "api"),

        // HowTo category (5 templates — 4 match, 1 miss)
        ("How to reset my password", "I forgot my password and clicked the reset link on the login page but the email was never sent to my inbox.", "web"),
        ("How to export my data as CSV", "I need to navigate to settings and export all my data in CSV or JSON format for compliance.", "email"),
        ("How to enable two-factor authentication", "I want to enable 2FA under my security settings using an authenticator app like Google Authenticator or Authy.", "web"),
        ("How to configure notification alerts", "I want to go to my profile notifications and disable email alerts and in-app alerts for non-critical events.", "api"),
        ("How to invite team members", "I want to add three colleagues to my workspace but cannot find the invite option anywhere in settings.", "email"),

        // FeatureRequest category (5 templates — 3 match, 2 miss)
        ("Submit a feature request via feedback", "How do I submit feature requests through the feedback portal? I want my vote to count in the quarterly review process.", "web"),
        ("Dark mode and API v2 on the roadmap", "Are dark mode and API v2 upcoming features on the public roadmap? Would love timelines for bulk operations too.", "api"),
        ("Add Slack integration for alerts", "We use Slack for team communication and would love to get ticket alerts directly in our channels.", "email"),
        ("Add bulk operations to the platform", "Bulk operations for managing multiple items would save time. Is this an upcoming feature on the public roadmap with timelines?", "web"),
        ("Export metrics as PDF report", "Management needs monthly PDF summaries of resolution rates and ticket volumes for executive review.", "api"),

        // AccountIssue category (5 templates — 4 match, 1 miss)
        ("Forgot password and reset email not arriving", "I clicked forgot password on the login page and entered my email but the reset link was never sent to my inbox.", "email"),
        ("Cancel my subscription and get a refund", "I want to cancel my subscription and need a refund. I went to billing but the cancel subscription option is not available within the 7 days window.", "web"),
        ("Two-factor authentication code not working", "The authenticator app code is not accepted. I enabled 2FA under security settings using Google Authenticator but it keeps failing.", "api"),
        ("Account locked after failed logins", "My account was locked after multiple failed login attempts. I need to click forgot password on the login page to get a reset link sent to my email.", "email"),
        ("Billing address not updating", "Every time I save a new billing address the old one reappears and the update never persists.", "web"),

        // Other category (4 templates — 2 match, 2 miss)
        ("Check service status and uptime", "Where can I check the service status page for real-time information about outages and scheduled maintenance windows?", "web"),
        ("Contact the support team", "How do I reach the support team via email or through the in-app chat widget during weekdays?", "email"),
        ("Feedback on the new dashboard UI", "The new dashboard design looks good but the font size in the sidebar feels too small on 1080p monitors.", "api"),
        ("Question about data retention policy", "How long does the system keep closed ticket records before archiving or permanently deleting them?", "web"),
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

        // Reset to a clean slate before each demo run
        db.ActivityLogs.RemoveRange(db.ActivityLogs);
        db.Tickets.RemoveRange(db.Tickets);
        await db.SaveChangesAsync();

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
