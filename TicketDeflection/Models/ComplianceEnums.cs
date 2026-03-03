#nullable enable

namespace TicketDeflection.Models;

public enum ComplianceDisposition
{
    AUTO_BLOCK,
    HUMAN_REQUIRED,
    ADVISORY
}

public enum ComplianceRegulation
{
    PIPEDA,
    FINTRAC
}

public enum FindingSeverity
{
    Low,
    Medium,
    High,
    Critical
}

public enum ContentType
{
    CODE,
    DIFF,
    LOG,
    FREETEXT
}

public enum ComplianceDecisionType
{
    Approved,
    Rejected
}
