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
}
