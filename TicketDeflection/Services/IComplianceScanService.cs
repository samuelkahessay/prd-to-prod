#nullable enable

using TicketDeflection.Data;
using TicketDeflection.Models;

namespace TicketDeflection.Services;

public interface IComplianceScanService
{
    Task<ComplianceScan> ScanAsync(string content, ContentType contentType, string? sourceLabel, TicketDbContext db);
}
