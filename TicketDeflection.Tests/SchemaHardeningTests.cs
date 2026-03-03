using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using TicketDeflection.Data;
using TicketDeflection.Models;

namespace TicketDeflection.Tests;

public class SchemaHardeningTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly TicketDbContext _context;

    public SchemaHardeningTests()
    {
        // Use real SQLite so FK constraints are enforced
        _connection = new SqliteConnection("Data Source=:memory:");
        _connection.Open();

        // Enable FK enforcement (SQLite disables by default)
        using var cmd = _connection.CreateCommand();
        cmd.CommandText = "PRAGMA foreign_keys = ON;";
        cmd.ExecuteNonQuery();

        var options = new DbContextOptionsBuilder<TicketDbContext>()
            .UseSqlite(_connection)
            .Options;
        _context = new TicketDbContext(options);
        _context.Database.EnsureCreated();
    }

    [Fact]
    public async Task ActivityLog_RequiresValidTicketId()
    {
        var orphanLog = new ActivityLog
        {
            TicketId = Guid.NewGuid(), // non-existent ticket
            Action = "Classified",
            Details = "Should fail"
        };
        _context.ActivityLogs.Add(orphanLog);

        await Assert.ThrowsAsync<DbUpdateException>(
            () => _context.SaveChangesAsync());
    }

    [Fact]
    public async Task ActivityLog_CascadeDeletesWithTicket()
    {
        var ticket = new Ticket
        {
            Title = "Test",
            Description = "Test",
            Source = "test"
        };
        _context.Tickets.Add(ticket);
        await _context.SaveChangesAsync();

        _context.ActivityLogs.Add(new ActivityLog
        {
            TicketId = ticket.Id,
            Action = "Classified",
            Details = "Bug"
        });
        await _context.SaveChangesAsync();

        _context.Tickets.Remove(ticket);
        await _context.SaveChangesAsync();

        var logCount = await _context.ActivityLogs.CountAsync();
        Assert.Equal(0, logCount);
    }

    [Fact]
    public async Task ComplianceDecision_RestrictDeleteOfScanWithDecision()
    {
        var scan = new ComplianceScan
        {
            ContentType = ContentType.CODE,
            Disposition = ComplianceDisposition.HUMAN_REQUIRED
        };
        _context.ComplianceScans.Add(scan);
        await _context.SaveChangesAsync();

        _context.ComplianceDecisions.Add(new ComplianceDecision
        {
            ScanId = scan.Id,
            OperatorId = "test-operator",
            Decision = ComplianceDecisionType.Approved
        });
        await _context.SaveChangesAsync();

        // EF Core enforces Restrict at the change tracker level when both
        // entities are tracked, throwing InvalidOperationException at Remove()
        // before the DELETE even reaches the database.
        Assert.Throws<InvalidOperationException>(
            () => _context.ComplianceScans.Remove(scan));
    }

    [Fact]
    public async Task ComplianceFinding_CascadeDeletesWithScan()
    {
        var scan = new ComplianceScan
        {
            ContentType = ContentType.CODE,
            Disposition = ComplianceDisposition.ADVISORY
        };
        _context.ComplianceScans.Add(scan);
        await _context.SaveChangesAsync();

        _context.ComplianceFindings.Add(new ComplianceFinding
        {
            ScanId = scan.Id,
            Regulation = ComplianceRegulation.PIPEDA,
            RuleId = "TEST-001",
            RuleName = "Test Rule",
            Citation = "Test",
            Category = "test",
            Severity = FindingSeverity.Low,
            Disposition = ComplianceDisposition.ADVISORY
        });
        await _context.SaveChangesAsync();

        _context.ComplianceScans.Remove(scan);
        await _context.SaveChangesAsync();

        var findingCount = await _context.ComplianceFindings.CountAsync();
        Assert.Equal(0, findingCount);
    }

    public void Dispose()
    {
        _context.Dispose();
        _connection.Dispose();
    }
}
