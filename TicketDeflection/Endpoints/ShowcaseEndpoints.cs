using TicketDeflection.Services;

namespace TicketDeflection.Endpoints;

public static class ShowcaseEndpoints
{
    public static void MapShowcaseEndpoints(this WebApplication app)
    {
        app.MapGet("/api/showcase/{slug}/timeline", async (string slug, IShowcaseService showcase) =>
        {
            var detail = await showcase.GetRunDetailAsync(slug);
            if (detail is null)
                return Results.NotFound(new { error = $"No completed run found for slug '{slug}'" });

            return Results.Ok(new
            {
                run = new
                {
                    slug = detail.Slug,
                    number = detail.Number,
                    name = detail.Name,
                    tag = detail.Tag,
                    tech_stack = detail.TechStack,
                    date = detail.Date,
                    issues = detail.IssueCount,
                    prs = detail.PrCount
                },
                stats = new
                {
                    issues_created = detail.Stats.IssuesCreated,
                    prs_total = detail.Stats.PrsTotal,
                    prs_merged = detail.Stats.PrsMerged,
                    lines_added = detail.Stats.LinesAdded,
                    lines_removed = detail.Stats.LinesRemoved,
                    files_changed = detail.Stats.FilesChanged
                },
                timeline = detail.Timeline.Select(e => new
                {
                    timestamp = e.Timestamp,
                    @event = e.Event,
                    item = e.Item,
                    title = e.Title
                })
            });
        });
    }
}
