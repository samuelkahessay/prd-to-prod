using Microsoft.AspNetCore.Mvc.RazorPages;
using TicketDeflection.Services;

namespace TicketDeflection.Pages;

public class OperatorModel : PageModel
{
    private readonly IDecisionLedgerService _ledger;
    private readonly IDrillReportService _drills;
    private static readonly string[] HardBoundaryActions =
    [
        "workflow_file_change",
        "policy_artifact_change",
        "merge_scope_expansion",
        "deploy_policy_change",
        "branch_protection_change",
        "secret_or_token_change"
    ];

    public OperatorModel(IDecisionLedgerService ledger, IDrillReportService drills)
    {
        _ledger = ledger;
        _drills = drills;
    }

    public DecisionQueue Queue { get; private set; } = new([], [], []);
    public DecisionMetrics Metrics { get; private set; } = new(0, 0, 0, 0, 0, null);
    public IReadOnlyList<DecisionEvent> RecentDecisions { get; private set; } = [];
    public IReadOnlyList<DecisionEvent> DecisionTrail { get; private set; } = [];
    public DecisionEvent? FeaturedBoundaryStop { get; private set; }
    public IReadOnlyList<DrillReport> DrillRuns { get; private set; } = [];

    public async Task OnGetAsync()
    {
        var all = await _ledger.GetDecisionsAsync();
        DecisionTrail = all;
        RecentDecisions = all.Take(6).ToList();

        var blocked = all.Where(e => e.Outcome == "blocked").ToList();
        var queuedForHuman = all.Where(e => e.Outcome == "queued_for_human").ToList();
        var recentAutonomous = all
            .Where(e => e.Outcome == "acted" && e.PolicyResult.Mode == "autonomous")
            .ToList();
        Queue = new DecisionQueue(blocked, queuedForHuman, recentAutonomous);

        var autonomousActed = all.Count(e => e.Outcome == "acted" && e.PolicyResult.Mode == "autonomous");
        var escalated = all.Count(e => e.Outcome == "escalated");
        string? lastUpdatedUtc = all.Count > 0 ? all[0].Timestamp : null;
        Metrics = new DecisionMetrics(all.Count, autonomousActed, blocked.Count, queuedForHuman.Count, escalated, lastUpdatedUtc);

        FeaturedBoundaryStop = Queue.Blocked.FirstOrDefault(IsHardBoundaryStop)
            ?? Queue.QueuedForHuman.FirstOrDefault(IsHardBoundaryStop);

        DrillRuns = (await _drills.GetReportsAsync())
            .Where(r => r.Verdict != "pending")
            .Take(10)
            .ToList();
    }

    private static bool IsHardBoundaryStop(DecisionEvent decision)
    {
        return HardBoundaryActions.Contains(decision.RequestedAction, StringComparer.Ordinal);
    }

    public static DrillRunStageSummary GetDrillStageSummary(DrillReport report)
    {
        var completed = 0;
        var manual = 0;
        var failed = 0;

        foreach (var stage in report.Stages.Values)
        {
            switch (stage.Status)
            {
                case "pass":
                    completed++;
                    break;
                case "pass_manual":
                    completed++;
                    manual++;
                    break;
                default:
                    failed++;
                    break;
            }
        }

        return new DrillRunStageSummary(completed, manual, failed);
    }

    public static string GetDrillDurationText(DrillReport report)
    {
        var stageTimes = report.Stages.Values
            .Select(stage => ParseTimestamp(stage.Timestamp))
            .Where(timestamp => timestamp is not null)
            .Select(timestamp => timestamp!.Value)
            .OrderBy(timestamp => timestamp)
            .ToList();

        if (stageTimes.Count >= 2)
            return FormatDuration(stageTimes[^1] - stageTimes[0]);

        var start = ParseTimestamp(report.StartedAt);
        var end = ParseTimestamp(report.CompletedAt);
        if (start is not null && end is not null)
            return FormatDuration(end.Value - start.Value);

        return "—";
    }

    private static DateTimeOffset? ParseTimestamp(string? value)
    {
        return DateTimeOffset.TryParse(value, out var parsed) ? parsed : null;
    }

    private static string FormatDuration(TimeSpan duration)
    {
        if (duration < TimeSpan.Zero)
            duration = duration.Negate();

        if (duration.TotalHours >= 1)
            return $"{(int)duration.TotalHours}h{duration.Minutes:D2}m";

        if (duration.TotalMinutes >= 1)
            return $"{(int)duration.TotalMinutes}m{duration.Seconds:D2}s";

        return $"{duration.TotalSeconds:F0}s";
    }
}

public sealed record DrillRunStageSummary(
    int CompletedCount,
    int ManualCount,
    int FailedCount);
