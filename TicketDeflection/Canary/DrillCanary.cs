namespace TicketDeflection.Canary;

/// <summary>
/// Canary class for self-healing drill suite.
/// This file is intentionally simple. The drill harness injects
/// a compiler error here; the pipeline agent's job is to fix it.
/// DO NOT add logic or references to this class.
/// </summary>
public static class DrillCanary
{
    public static string Status() => "healthy";
}
