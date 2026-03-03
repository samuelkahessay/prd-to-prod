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

    public List<ComplianceScan> HumanRequiredScans { get; set; } = new();
    public List<ComplianceScan> AutoBlockedScans { get; set; } = new();
    public List<ComplianceScan> RecentScans { get; set; } = new();

    public async Task OnGetAsync()
    {
        var all = await _db.ComplianceScans
            .Include(s => s.Findings)
            .OrderByDescending(s => s.SubmittedAt)
            .Take(50)
            .ToListAsync();

        HumanRequiredScans = all.Where(s => s.Disposition == ComplianceDisposition.HUMAN_REQUIRED).ToList();
        AutoBlockedScans   = all.Where(s => s.Disposition == ComplianceDisposition.AUTO_BLOCK).ToList();
        RecentScans        = all.Take(20).ToList();
    }
}
