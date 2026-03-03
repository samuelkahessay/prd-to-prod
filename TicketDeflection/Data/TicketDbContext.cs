using Microsoft.EntityFrameworkCore;
using TicketDeflection.Models;

namespace TicketDeflection.Data;

public class TicketDbContext : DbContext
{
    public TicketDbContext(DbContextOptions<TicketDbContext> options) : base(options) { }

    public DbSet<Ticket> Tickets => Set<Ticket>();
    public DbSet<KnowledgeArticle> KnowledgeArticles => Set<KnowledgeArticle>();
    public DbSet<ActivityLog> ActivityLogs => Set<ActivityLog>();
    public DbSet<ComplianceScan> ComplianceScans => Set<ComplianceScan>();
    public DbSet<ComplianceFinding> ComplianceFindings => Set<ComplianceFinding>();
    public DbSet<ComplianceDecision> ComplianceDecisions => Set<ComplianceDecision>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // ActivityLog → Ticket (missing FK — added for schema hardening)
        modelBuilder.Entity<ActivityLog>()
            .HasOne<Ticket>()
            .WithMany()
            .HasForeignKey(a => a.TicketId)
            .OnDelete(DeleteBehavior.Cascade);

        // ComplianceFinding → ComplianceScan
        modelBuilder.Entity<ComplianceFinding>()
            .HasOne(f => f.Scan)
            .WithMany(s => s.Findings)
            .HasForeignKey(f => f.ScanId)
            .OnDelete(DeleteBehavior.Cascade);

        // ComplianceDecision → ComplianceScan (Restrict: protect audit trail)
        modelBuilder.Entity<ComplianceDecision>()
            .HasOne(d => d.Scan)
            .WithMany()
            .HasForeignKey(d => d.ScanId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<ComplianceDecision>()
            .Property(d => d.Decision)
            .HasConversion<string>();

        modelBuilder.Entity<ComplianceDecision>()
            .HasIndex(d => d.ScanId)
            .IsUnique();
    }
}
