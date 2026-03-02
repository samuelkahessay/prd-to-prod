using TicketDeflection.Models;

namespace TicketDeflection.Services;

public interface IShowcaseService
{
    /// <summary>Returns all completed showcase runs sorted by Number ascending.</summary>
    Task<IReadOnlyList<ShowcaseRun>> GetCompletedRunsAsync();

    /// <summary>Returns full run detail for the given slug, or null if not found.</summary>
    Task<ShowcaseRunDetail?> GetRunDetailAsync(string slug);
}
