# Operator Past Runs — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Past Runs" section to the operator page showing drill run cards and a decision trail.

**Architecture:** New `IDrillReportService` mirrors the existing `DecisionLedgerService` pattern — reads JSON files from `drills/reports/`, deserializes into records, returns sorted newest-first. The operator page model gains a `DrillRuns` property. The Razor template adds a new section below the existing grid.

**Tech Stack:** ASP.NET Razor Pages, System.Text.Json, xUnit + WebApplicationFactory integration tests

---

### Task 1: Drill Report Records

**Files:**
- Create: `TicketDeflection/Services/IDrillReportService.cs`

**Step 1: Create the interface and records file**

This mirrors the pattern in `IDecisionLedgerService.cs`. The records match the JSON schema in `drills/reports/*.json`.

```csharp
namespace TicketDeflection.Services;

public interface IDrillReportService
{
    Task<IReadOnlyList<DrillReport>> GetReportsAsync();
}

public sealed record DrillReport(
    string DrillId,
    string DrillType,
    string? FailureSignature,
    string Verdict,
    string? StartedAt,
    string? CompletedAt,
    Dictionary<string, DrillStage> Stages);

public sealed record DrillStage(
    string Status,
    string? Timestamp,
    int ElapsedFromPreviousS,
    int SlaS,
    string? Url);
```

**Step 2: Commit**

```bash
git add TicketDeflection/Services/IDrillReportService.cs
git commit -m "feat(operator): add drill report records and interface"
```

---

### Task 2: Drill Report Service

**Files:**
- Create: `TicketDeflection/Services/DrillReportService.cs`

**Step 1: Implement the service**

Follow the same pattern as `DecisionLedgerService.cs` (lines 1-120): constructor takes `IConfiguration` + `IWebHostEnvironment` + `ILogger`, resolves path from config key `DrillReports:Path` with fallback to `../drills/reports/`, reads all `*.json` files, deserializes, sorts by `StartedAt` descending.

```csharp
using System.Text.Json;

namespace TicketDeflection.Services;

public sealed class DrillReportService : IDrillReportService
{
    private readonly string _reportsPath;
    private readonly ILogger<DrillReportService> _logger;

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        PropertyNameCaseInsensitive = true
    };

    public DrillReportService(
        IConfiguration configuration,
        IWebHostEnvironment env,
        ILogger<DrillReportService> logger)
    {
        _logger = logger;
        var configured = configuration["DrillReports:Path"];
        _reportsPath = !string.IsNullOrEmpty(configured)
            ? configured
            : ResolveDefaultReportsPath(env.ContentRootPath);
    }

    internal static string ResolveDefaultReportsPath(string contentRoot)
    {
        var publishedPath = Path.GetFullPath(Path.Combine(contentRoot, "drills", "reports"));
        if (Directory.Exists(publishedPath))
            return publishedPath;
        return Path.GetFullPath(Path.Combine(contentRoot, "..", "drills", "reports"));
    }

    public Task<IReadOnlyList<DrillReport>> GetReportsAsync()
    {
        var reports = LoadAllReports();
        reports.Sort((a, b) => CompareTimestampsDescending(a.StartedAt, b.StartedAt));
        return Task.FromResult<IReadOnlyList<DrillReport>>(reports);
    }

    private List<DrillReport> LoadAllReports()
    {
        var results = new List<DrillReport>();

        if (!Directory.Exists(_reportsPath))
        {
            _logger.LogWarning("Drill reports directory not found at {Path}", _reportsPath);
            return results;
        }

        foreach (var file in Directory.EnumerateFiles(_reportsPath, "*.json"))
        {
            try
            {
                var json = File.ReadAllText(file);
                var report = JsonSerializer.Deserialize<DrillReport>(json, JsonOpts);
                if (report is not null)
                    results.Add(report);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Skipping drill report {File}: failed to parse", file);
            }
        }

        return results;
    }

    private static int CompareTimestampsDescending(string? left, string? right)
    {
        var leftParsed = ParseTimestamp(left);
        var rightParsed = ParseTimestamp(right);
        return rightParsed.CompareTo(leftParsed);
    }

    private static DateTimeOffset ParseTimestamp(string? value)
    {
        if (string.IsNullOrEmpty(value))
            return DateTimeOffset.MinValue;
        return DateTimeOffset.TryParse(value, out var parsed)
            ? parsed
            : DateTimeOffset.MinValue;
    }
}
```

**Step 2: Register in DI**

In `TicketDeflection/Program.cs`, add after the `IDecisionLedgerService` registration (line 20):

```csharp
builder.Services.AddSingleton<IDrillReportService, DrillReportService>();
```

**Step 3: Run build to verify**

Run: `dotnet build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add TicketDeflection/Services/DrillReportService.cs TicketDeflection/Program.cs
git commit -m "feat(operator): implement drill report service"
```

---

### Task 3: Wire Drill Reports into Operator Page Model

**Files:**
- Modify: `TicketDeflection/Pages/Operator.cshtml.cs`

**Step 1: Add service injection and DrillRuns property**

Add `IDrillReportService` as a second constructor parameter. Add `DrillRuns` property. Load in `OnGetAsync()`.

In the constructor, add `_drills` field:
```csharp
private readonly IDrillReportService _drills;
```

Update the constructor signature:
```csharp
public OperatorModel(IDecisionLedgerService ledger, IDrillReportService drills)
{
    _ledger = ledger;
    _drills = drills;
}
```

Add property:
```csharp
public IReadOnlyList<DrillReport> DrillRuns { get; private set; } = [];
```

At the end of `OnGetAsync()`, add:
```csharp
DrillRuns = (await _drills.GetReportsAsync())
    .Where(r => r.Verdict != "pending")
    .Take(10)
    .ToList();
```

Note: Filter out `pending` drills — these are incomplete/stalled runs with no stage data. The `Take(10)` caps the display to the 10 most recent completed runs.

**Step 2: Run build to verify**

Run: `dotnet build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add TicketDeflection/Pages/Operator.cshtml.cs
git commit -m "feat(operator): load drill reports in page model"
```

---

### Task 4: Add Past Runs UI Section

**Files:**
- Modify: `TicketDeflection/Pages/Operator.cshtml`

**Step 1: Add styles for drill run cards**

In the `@section Styles` block (after the `.empty-state` rule, before `</style>`), add:

```css
.run-card {
    background: rgba(9, 16, 28, 0.6);
    border: 1px solid var(--border);
    padding: 14px 16px;
    margin-bottom: 8px;
}
.run-card:last-child {
    margin-bottom: 0;
}
.stage-dots {
    display: flex;
    gap: 4px;
    align-items: center;
}
.stage-dot {
    width: 8px;
    height: 8px;
    border-radius: 2px;
}
.stage-dot-pass {
    background: var(--green);
}
.stage-dot-fail {
    background: var(--red);
}
.stage-dot-skip {
    background: var(--border);
}
.run-duration {
    color: var(--dim);
    font-size: 0.72rem;
    font-family: var(--mono);
}
```

**Step 2: Add the past runs section**

After the closing `</div>` of the existing bottom grid (line 315 — the `</div>` right before `</div>` on line 316), insert:

```html
    <section class="panel panel-top p-5 mt-8" aria-labelledby="past-runs-heading">
        <div class="flex items-center justify-between mb-4">
            <div>
                <div class="text-xs text-dim uppercase tracking-widest mb-1">// past runs</div>
                <h2 id="past-runs-heading" class="font-sans text-2xl font-bold text-white">Past Runs</h2>
            </div>
            <span class="badge badge-blue">@Model.DrillRuns.Count runs</span>
        </div>

        @if (Model.DrillRuns.Count == 0)
        {
            <div class="empty-state">No completed drill runs recorded.</div>
        }
        else
        {
            @foreach (var run in Model.DrillRuns)
            {
                var stageNames = new[] { "ci_failure", "issue_created", "auto_dispatch", "repair_pr", "ci_green", "auto_merge", "main_recovered" };
                var passedCount = run.Stages.Count(s => s.Value.Status == "pass");
                var totalStages = stageNames.Length;
                var durationText = "—";
                if (DateTimeOffset.TryParse(run.StartedAt, out var start) && DateTimeOffset.TryParse(run.CompletedAt, out var end))
                {
                    var dur = end - start;
                    durationText = dur.TotalMinutes >= 1 ? $"{dur.Minutes}m{dur.Seconds:D2}s" : $"{dur.TotalSeconds:F0}s";
                }
                var verdictBadge = run.Verdict switch
                {
                    "PASS" => "badge-green",
                    "FAIL" => "badge-red",
                    _ => "badge-amber"
                };

                <div class="run-card">
                    <div class="flex flex-wrap items-center gap-3 mb-2">
                        <span class="badge @verdictBadge">@run.Verdict</span>
                        <span class="text-white text-sm font-medium">@run.DrillId</span>
                        <span class="run-duration">@durationText</span>
                        <span class="text-dim text-xs">@passedCount/@totalStages stages</span>
                    </div>
                    <div class="flex items-center gap-3">
                        <span class="code-pill">@run.DrillType</span>
                        @if (!string.IsNullOrEmpty(run.FailureSignature))
                        {
                            <span class="text-dim text-xs">@run.FailureSignature</span>
                        }
                    </div>
                    <div class="stage-dots mt-3">
                        @foreach (var name in stageNames)
                        {
                            var dotClass = run.Stages.TryGetValue(name, out var stage)
                                ? (stage.Status == "pass" ? "stage-dot-pass" : "stage-dot-fail")
                                : "stage-dot-skip";
                            <div class="stage-dot @dotClass" title="@name"></div>
                        }
                        <span class="text-dim text-xs ml-2">
                            @string.Join(" → ", stageNames.Select(n => n.Split('_').First()))
                        </span>
                    </div>
                </div>
            }
        }

        <div class="mt-6 pt-4" style="border-top: 1px solid var(--border);">
            <div class="text-xs text-dim uppercase tracking-widest mb-3">decision trail</div>
            @foreach (var decision in Model.Decisions)
            {
                <article class="record">
                    <div class="flex flex-wrap items-center gap-2 mb-1">
                        <span class="badge @(decision.Outcome == "blocked" ? "badge-red" : decision.Outcome == "queued_for_human" ? "badge-amber" : "badge-green")">@decision.Outcome</span>
                        <span class="code-pill">@decision.RequestedAction</span>
                        <span class="text-dim text-xs">@decision.Timestamp</span>
                    </div>
                    <div class="summary-line">@decision.Summary</div>
                </article>
            }
        </div>
    </section>
```

**Step 3: Run build to verify**

Run: `dotnet build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add TicketDeflection/Pages/Operator.cshtml
git commit -m "feat(operator): add past runs section with drill cards and decision trail"
```

---

### Task 5: Tests

**Files:**
- Modify: `TicketDeflection.Tests/OperatorPageTests.cs`

**Step 1: Add drill report test data to constructor**

In `OperatorPageTests()`, after `Directory.CreateDirectory(_decisionsDir);`, add:

```csharp
_reportsDir = Path.Combine(_tempDir, "reports");
Directory.CreateDirectory(_reportsDir);

WriteDrillReport(new
{
    drill_id = "20260302-152002",
    drill_type = "main_build_syntax",
    failure_signature = "cs1002-missing-semicolon",
    verdict = "PASS",
    started_at = "2026-03-02T15:20:03Z",
    completed_at = "2026-03-02T15:32:25Z",
    stages = new Dictionary<string, object>
    {
        ["ci_failure"] = new { status = "pass", timestamp = "2026-03-02T15:20:07Z", elapsed_from_previous_s = 3, sla_s = 120, url = "" },
        ["issue_created"] = new { status = "pass", timestamp = "2026-03-02T15:21:03Z", elapsed_from_previous_s = 56, sla_s = 120, url = "" },
        ["auto_dispatch"] = new { status = "pass", timestamp = "2026-03-02T15:21:33Z", elapsed_from_previous_s = 30, sla_s = 120, url = "" },
        ["repair_pr"] = new { status = "pass", timestamp = "2026-03-02T15:26:24Z", elapsed_from_previous_s = 291, sla_s = 600, url = "" },
        ["ci_green"] = new { status = "pass", timestamp = "2026-03-02T15:27:08Z", elapsed_from_previous_s = 44, sla_s = 900, url = "" },
        ["auto_merge"] = new { status = "pass", timestamp = "2026-03-02T15:30:09Z", elapsed_from_previous_s = 181, sla_s = 600, url = "" },
        ["main_recovered"] = new { status = "pass", timestamp = "2026-03-02T15:32:17Z", elapsed_from_previous_s = 128, sla_s = 300, url = "" }
    }
});
```

Add `_reportsDir` field alongside `_decisionsDir`:
```csharp
private readonly string _reportsDir;
```

Update the `WebApplicationFactory` config to include:
```csharp
["DrillReports:Path"] = _reportsDir,
```

Add helper method:
```csharp
private void WriteDrillReport(object report)
{
    var json = JsonSerializer.Serialize(report, JsonOpts);
    var id = json.Contains("drill_id") ? "test-drill" : Guid.NewGuid().ToString("N");
    File.WriteAllText(Path.Combine(_reportsDir, $"{id}.json"), json);
}
```

**Step 2: Add test for past runs section rendering**

```csharp
[Fact]
public async Task Operator_RendersPastRunsSection()
{
    var client = _factory.CreateClient();
    var html = await client.GetStringAsync("/operator");

    Assert.Contains("Past Runs", html);
    Assert.Contains("20260302-152002", html);
    Assert.Contains("PASS", html);
    Assert.Contains("main_build_syntax", html);
    Assert.Contains("cs1002-missing-semicolon", html);
    Assert.Contains("7/7 stages", html);
    Assert.Contains("decision trail", html);
}
```

**Step 3: Run tests**

Run: `dotnet test --filter "OperatorPage" --verbosity quiet`
Expected: All 4 tests pass

**Step 4: Commit**

```bash
git add TicketDeflection.Tests/OperatorPageTests.cs
git commit -m "test(operator): add past runs section tests"
```

---

### Task 6: Manual Verification

**Step 1: Run the app**

Run: `dotnet run --project TicketDeflection --launch-profile http`

**Step 2: Navigate to /operator**

Open `http://localhost:5230/operator` and scroll to the bottom. Verify:
- "Past Runs" section appears
- Drill run cards show with correct verdict badges, durations, and stage dots
- Decision trail shows below the drill cards
- Empty state shows correctly if no reports exist

**Step 3: Run full test suite**

Run: `dotnet test --verbosity quiet`
Expected: All tests pass
