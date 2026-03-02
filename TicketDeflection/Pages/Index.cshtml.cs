using Microsoft.AspNetCore.Mvc.RazorPages;
using TicketDeflection.Models;
using TicketDeflection.Services;

namespace TicketDeflection.Pages;

public class IndexModel : PageModel
{
    private readonly IShowcaseService _showcase;

    public IndexModel(IShowcaseService showcase)
    {
        _showcase = showcase;
    }

    public IReadOnlyList<ShowcaseRun> CompletedRuns { get; private set; } = [];
    public int TotalRuns { get; private set; }
    public int TotalIssues { get; private set; }
    public int TotalPrs { get; private set; }

    public async Task OnGetAsync()
    {
        CompletedRuns = await _showcase.GetCompletedRunsAsync();
        TotalRuns = CompletedRuns.Count;
        TotalIssues = CompletedRuns.Sum(r => r.IssueCount);
        TotalPrs = CompletedRuns.Sum(r => r.PrCount);
    }
}
