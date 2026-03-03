using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using TicketDeflection.Data;
using TicketDeflection.Models;

namespace TicketDeflection.Pages;

public class ComplianceModel : PageModel
{
    private readonly TicketDbContext _db;

    public ComplianceModel(TicketDbContext db)
    {
        _db = db;
    }

    public List<ComplianceScan> PendingHumanRequiredScans { get; set; } = new();
    public List<ComplianceScan> AutoBlockedScans { get; set; } = new();
    public List<ComplianceScan> RecentScans { get; set; } = new();
    public int TotalScans { get; set; }
    public int HumanRequiredCount { get; set; }
    public int AutoBlockedCount { get; set; }
    public int AdvisoryCount { get; set; }
    public int PendingDecisionCount { get; set; }

    public async Task OnGetAsync()
    {
        var all = await _db.ComplianceScans
            .Include(s => s.Findings)
            .OrderByDescending(s => s.SubmittedAt)
            .Take(50)
            .ToListAsync();

        var decidedScanIds = await _db.ComplianceDecisions
            .Select(d => d.ScanId)
            .Distinct()
            .ToHashSetAsync();

        TotalScans = all.Count;
        HumanRequiredCount = all.Count(s => s.Disposition == ComplianceDisposition.HUMAN_REQUIRED);
        AutoBlockedCount = all.Count(s => s.Disposition == ComplianceDisposition.AUTO_BLOCK);
        AdvisoryCount = all.Count(s => s.Disposition == ComplianceDisposition.ADVISORY);
        PendingHumanRequiredScans = all
            .Where(s => s.Disposition == ComplianceDisposition.HUMAN_REQUIRED && !decidedScanIds.Contains(s.Id))
            .ToList();
        PendingDecisionCount = PendingHumanRequiredScans.Count;
        AutoBlockedScans = all.Where(s => s.Disposition == ComplianceDisposition.AUTO_BLOCK).ToList();
        RecentScans = all.Take(20).ToList();
    }
}
