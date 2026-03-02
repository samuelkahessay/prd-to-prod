using TicketDeflection.Services;

namespace TicketDeflection.Tests;

public class ShowcaseServicePathTests : IDisposable
{
    private readonly string _tempRoot;

    public ShowcaseServicePathTests()
    {
        _tempRoot = Path.Combine(Path.GetTempPath(), $"showcase-test-{Guid.NewGuid():N}");
        Directory.CreateDirectory(_tempRoot);
    }

    public void Dispose() => Directory.Delete(_tempRoot, recursive: true);

    [Fact]
    public void ResolveDefaultShowcasePath_PrefersPublishedPath_WhenShowcaseFolderExistsUnderContentRoot()
    {
        // Simulate published output: showcase/ sits directly under ContentRootPath
        var publishedShowcase = Path.Combine(_tempRoot, "showcase");
        Directory.CreateDirectory(publishedShowcase);

        var resolved = ShowcaseService.ResolveDefaultShowcasePath(_tempRoot);

        Assert.Equal(Path.GetFullPath(publishedShowcase), resolved);
    }

    [Fact]
    public void ResolveDefaultShowcasePath_FallsBackToParent_WhenShowcaseFolderAbsent()
    {
        // Simulate local dev: ContentRootPath is the project subdir, showcase is at repo root
        var projectDir = Path.Combine(_tempRoot, "TicketDeflection");
        Directory.CreateDirectory(projectDir);
        // Do NOT create projectDir/showcase — should fall back to parent

        var resolved = ShowcaseService.ResolveDefaultShowcasePath(projectDir);

        Assert.Equal(Path.GetFullPath(Path.Combine(_tempRoot, "showcase")), resolved);
    }
}
