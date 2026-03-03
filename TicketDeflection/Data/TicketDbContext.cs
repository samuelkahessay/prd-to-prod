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
        modelBuilder.Entity<ComplianceFinding>()
            .HasOne(f => f.Scan)
            .WithMany(s => s.Findings)
            .HasForeignKey(f => f.ScanId);

        modelBuilder.Entity<ComplianceDecision>()
            .HasOne(d => d.Scan)
            .WithMany()
            .HasForeignKey(d => d.ScanId);

        modelBuilder.Entity<ComplianceDecision>()
            .Property(d => d.Decision)
            .HasConversion<string>();

        modelBuilder.Entity<ComplianceDecision>()
            .HasIndex(d => d.ScanId)
            .IsUnique();
    }
}
