using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using PRDtoProd.Data;
using PRDtoProd.Models;

namespace PRDtoProd.Pages;

public class ComplianceModel : PageModel
{
    private readonly TicketDbContext _db;

    public ComplianceModel(TicketDbContext db)
    {
        _db = db;
    }

    public List<ComplianceScan> PendingHumanRequiredScans { get; set; } = new();
    public List<ComplianceScan> RejectedScans { get; set; } = new();
    public List<ComplianceScan> AutoBlockedScans { get; set; } = new();
    public List<ComplianceScan> RecentScans { get; set; } = new();
    public int TotalScans { get; set; }
    public int HumanRequiredCount { get; set; }
    public int AutoBlockedCount { get; set; }
    public int AdvisoryCount { get; set; }
    public int PendingDecisionCount { get; set; }

    public async Task OnGetAsync()
    {
        var latestDecisions = await ComplianceQueries.GetLatestDecisionLookupAsync(_db);

        var approvedScanIds = latestDecisions
            .Where(kv => kv.Value == ComplianceDecisionType.Approved)
            .Select(kv => kv.Key)
            .ToHashSet();

        var rejectedScanIds = latestDecisions
            .Where(kv => kv.Value == ComplianceDecisionType.Rejected)
            .Select(kv => kv.Key)
            .ToHashSet();

        TotalScans = await _db.ComplianceScans
            .AsNoTracking()
            .CountAsync();

        HumanRequiredCount = await _db.ComplianceScans
            .AsNoTracking()
            .CountAsync(s => s.Disposition == ComplianceDisposition.HUMAN_REQUIRED);

        AutoBlockedCount = await _db.ComplianceScans
            .AsNoTracking()
            .CountAsync(s => s.Disposition == ComplianceDisposition.AUTO_BLOCK);

        AdvisoryCount = await _db.ComplianceScans
            .AsNoTracking()
            .CountAsync(s => s.Disposition == ComplianceDisposition.ADVISORY);

        var allHumanRequired = (await _db.ComplianceScans
            .AsNoTracking()
            .Include(s => s.Findings)
            .Where(s => s.Disposition == ComplianceDisposition.HUMAN_REQUIRED)
            .ToListAsync())
            .OrderByDescending(s => s.SubmittedAt)
            .ToList();

        // Only approved decisions remove scans from pending; rejected go to remediation
        PendingHumanRequiredScans = allHumanRequired
            .Where(s => !approvedScanIds.Contains(s.Id) && !rejectedScanIds.Contains(s.Id))
            .ToList();

        RejectedScans = allHumanRequired
            .Where(s => rejectedScanIds.Contains(s.Id))
            .ToList();

        PendingDecisionCount = PendingHumanRequiredScans.Count;

        AutoBlockedScans = (await _db.ComplianceScans
            .AsNoTracking()
            .Include(s => s.Findings)
            .Where(s => s.Disposition == ComplianceDisposition.AUTO_BLOCK)
            .ToListAsync())
            .OrderByDescending(s => s.SubmittedAt)
            .ToList();

        RecentScans = (await _db.ComplianceScans
            .AsNoTracking()
            .ToListAsync())
            .OrderByDescending(s => s.SubmittedAt)
            .Take(20)
            .ToList();
    }
}
