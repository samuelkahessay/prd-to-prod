#nullable enable

using Microsoft.EntityFrameworkCore;
using PRDtoProd.Models;

namespace PRDtoProd.Data;

public static class ComplianceQueries
{
    // SQLite cannot translate DateTimeOffset ORDER BY, so timestamp ordering happens in memory.
    public static async Task<Dictionary<Guid, ComplianceDecisionType?>> GetLatestDecisionLookupAsync(
        TicketDbContext db)
    {
        var decisions = await db.ComplianceDecisions
            .AsNoTracking()
            .Select(d => new { d.ScanId, d.Decision, d.DecidedAt })
            .ToListAsync();

        return decisions
            .GroupBy(d => d.ScanId)
            .ToDictionary(
                g => g.Key,
                g => g
                    .OrderByDescending(d => d.DecidedAt)
                    .Select(d => (ComplianceDecisionType?)d.Decision)
                    .FirstOrDefault());
    }
}
