using Microsoft.AspNetCore.Mvc.RazorPages;
using TicketDeflection.Services;

namespace TicketDeflection.Pages;

public class OperatorModel : PageModel
{
    private readonly IDecisionLedgerService _ledger;

    public OperatorModel(IDecisionLedgerService ledger)
    {
        _ledger = ledger;
    }

    public DecisionQueue Queue { get; private set; } = new([], [], []);
    public DecisionMetrics Metrics { get; private set; } = new(0, 0, 0, 0, 0, null);
    public IReadOnlyList<DecisionEvent> Decisions { get; private set; } = [];

    public async Task OnGetAsync()
    {
        Queue = await _ledger.GetQueueAsync();
        Metrics = await _ledger.GetMetricsAsync();
        Decisions = (await _ledger.GetDecisionsAsync()).Take(6).ToList();
    }
}
