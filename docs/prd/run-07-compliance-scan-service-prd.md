# PRD: Compliance Scan Service

## Overview

Build a Compliance Scan Service inside the existing ASP.NET Core application.
The service accepts code snippets, PR diffs, or log samples and scans them for
deterministic Canadian compliance violations. Findings are classified by
regulation, severity, and disposition:

- `AUTO_BLOCK`
- `HUMAN_REQUIRED`
- `ADVISORY`

A Razor Pages dashboard at `/compliance` shows the scan queue, findings feed,
metrics, and a live operator decision panel for escalated items.

The point is not "AI-powered compliance." The point is that the pipeline can
build a system that knows where automation must stop.

This is **Run 07** and should archive as:

- Showcase slug: `07-compliance-scan-service`
- Tag: `v7.0.0`

## Demo Goal

This run will be screen-recorded from the live page. The implementation must be
demo-safe on first load.

The recording should work without external services, manual database priming, or
editing files during the demo. On first visit to `/compliance`, the page must
already show:

- at least one `HUMAN_REQUIRED` item awaiting operator action
- at least one `AUTO_BLOCK` item
- at least one advisory or clean scan in the recent feed
- populated metrics

The live interaction loop during the demo is:

1. open `/compliance`
2. show the structural human/AI boundary
3. submit a sample scan
4. record a human decision on an escalated item
5. show the page update in place

## Run Mode

Enhancement run. Reuse the existing `TicketDeflection.sln` solution, the
existing `TicketDeflection` web project, the existing `TicketDeflection.Tests`
project, and the existing `dotnet-azure` deploy profile. Do not replace or
restructure the current app.

The compliance service is a new bounded context inside the same application. The
existing ticket deflection flows must continue to work unchanged.

Implementation constraints for this run:

- do not add a new solution or project
- do not modify workflow files under `.github/workflows/`
- do not add a frontend build step
- do not add external API calls
- do not add ML or LLM inference
- do not add new NuGet packages unless absolutely necessary
- keep the current operator/terminal visual language

Preferred file placement:

- models in `TicketDeflection/Models/`
- services in `TicketDeflection/Services/`
- endpoints in `TicketDeflection/Endpoints/`
- seed data and DbContext updates in `TicketDeflection/Data/`
- Razor Pages in `TicketDeflection/Pages/`
- tests in `TicketDeflection.Tests/`

## The Core Idea

Canadian fintech companies operate under two primary regulatory frameworks that
create concrete, automatable scan rules:

**PIPEDA (Personal Information Protection and Electronic Documents Act)** covers
how personal information is collected, used, and disclosed. In code, violations
look like Social Insurance Numbers in plain text, account numbers logged without
masking, date-of-birth fields exposed in logs, or personal identifiers leaked in
API responses and URLs.

**FINTRAC (Financial Transactions and Reports Analysis Centre of Canada)** covers
anti-money-laundering and reporting controls. In code, violations look like
transactions above CAD 10,000 without reporting markers, suspicious-review
bypasses, wire transfers without verification markers, or financial records with
missing audit fields.

The service scans submitted content against a static rule library and returns a
structured report. Clear violations are `AUTO_BLOCK`. Ambiguous or
context-dependent violations are `HUMAN_REQUIRED`. Clean or low-risk findings
are `ADVISORY`.

## Human/AI Boundary

| Decision | Owner | Reason |
|---|---|---|
| Detect pattern match | AI | Deterministic rule evaluation |
| Classify finding type | AI | Static rule metadata |
| Compute severity and disposition | AI | Weighted deterministic logic |
| `AUTO_BLOCK` clear violations | AI | Only for unambiguous rules |
| `HUMAN_REQUIRED` escalations | Human | Ambiguous context and regulatory interpretation |
| Remediation action | Human | Legal and policy consequences |
| Rule library changes | Human | Regulatory rule changes must be reviewed |
| Override a blocked or escalated result | Human | Must be explicit and auditable |

This boundary must be structural:

- `HUMAN_REQUIRED` findings include a reason the AI stopped
- `HUMAN_REQUIRED` response payloads do not include any remediation field
- the UI section heading must read `HUMAN DECISION REQUIRED`
- the human decision panel must render above the auto-blocked section

## Tech Stack

- Runtime: .NET 10, using the repo SDK pinned in `global.json`
- Framework: ASP.NET Core Minimal API + Razor Pages
- Language: C# with nullable enabled
- Data: EF Core InMemory using the existing app data layer
- Styling: existing shared layout, Tailwind CDN, and site CSS
- Testing: xUnit + `WebApplicationFactory`

## Validation Commands

- Restore: `dotnet restore TicketDeflection.sln`
- Build: `dotnet build TicketDeflection.sln --no-restore`
- Test: `dotnet test TicketDeflection.sln --no-build --verbosity normal`
- Run: `dotnet run --project TicketDeflection/TicketDeflection.csproj --urls http://localhost:5000`

## Rule Evaluation Contract

To keep the implementation deterministic and agent-friendly, rules use regex and
simple string heuristics only. No AST parsing or legal inference is required.

Definitions for this run:

- `near` means the same line or within 80 characters
- `missing nearby` means the required marker does not appear on the same line or
  within 120 characters after the main match
- `test context` means the source or content contains markers such as `test`,
  `tests`, `spec`, `fixture`, `sample`, `example`, `xUnit`, `Fact]`, or
  `Describe(`
- `log context` means the line contains markers such as `logger`, `log.`,
  `Console.`, `Debug.`, `Trace.`, or structured log keys
- negative-presence rules may evaluate the whole submitted snippet, not a full
  syntax tree

When a rule needs context, it should be implemented as "regex match plus nearby
required/forbidden keyword checks," not as free-form interpretation.

## Feature 1: Compliance Rule Library, Models, and Persistence

Define the static rule library, compliance entities, and persistence for scan
results and operator decisions.

### Technical Notes

- Rules live in static code such as `ComplianceRules.cs`; they are not
  user-editable and are not stored in the database
- Persist compliance data in the existing in-memory app database by extending
  `TicketDbContext`; do not introduce a new project or persistence stack
- Do not persist raw submitted content
- Every rule must include:
  - `Id`
  - `Regulation`
  - `Citation`
  - `Category`
  - `Description`
  - `Pattern`
  - `Severity`
  - `Disposition`
  - `AutoBlock`
  - `HumanRequiredReason` when applicable

### Minimum Rule Library

Implement at least 20 deterministic rules across `PIPEDA`, `FINTRAC`, and
`ADVISORY`. The exact regex can vary, but the behavior must cover the following
cases:

**PIPEDA**

- raw SIN in non-test context, invalid if the first digit is `0` or `8`:
  `CRITICAL`, `AUTO_BLOCK`
- account number-like digits near `account`, `acct`, or `number`:
  `HIGH`, `HUMAN_REQUIRED`
- `dob`, `date_of_birth`, or `birthdate` in a log context:
  `HIGH`, `AUTO_BLOCK`
- email address in a log context: `MEDIUM`, `HUMAN_REQUIRED`
- full name markers plus financial markers on the same line without
  `encrypted`, `masked`, or `redacted`: `HIGH`, `HUMAN_REQUIRED`
- unmasked Visa or Mastercard number: `CRITICAL`, `AUTO_BLOCK`
- SIN or account number in a URL, route, endpoint, or query string:
  `HIGH`, `AUTO_BLOCK`
- health information keywords in log or storage context without `encrypted` or
  `tokenized`: `MEDIUM`, `HUMAN_REQUIRED`

**FINTRAC**

- transaction amount above CAD 10,000 without `fintrac_reported`,
  `suspicious_flag`, or `ctr_required` nearby: `HIGH`, `HUMAN_REQUIRED`
- suspicious-review bypass where code approves or returns approved while
  skipping the review queue: `CRITICAL`, `AUTO_BLOCK`
- wire transfer flow without `beneficiary_verified` or `kyc_checked` nearby:
  `HIGH`, `HUMAN_REQUIRED`
- transaction or payment record snippet with amount fields but no audit fields
  such as `CreatedAt`, `AuditedBy`, or `OperatorId`: `MEDIUM`,
  `HUMAN_REQUIRED`
- FX or currency conversion operation without `exchange_rate` or rate audit
  markers: `MEDIUM`, `ADVISORY`
- explicit AML hold bypass such as `aml_hold = false`, `clearHold`, or
  equivalent override in a payment path: `CRITICAL`, `AUTO_BLOCK`
- transfer execution when `beneficiary_verified = false` or `kyc_checked = false`:
  `CRITICAL`, `AUTO_BLOCK`

**ADVISORY / ambiguous**

- hardcoded test credentials in a non-test file: `LOW`, `ADVISORY`
- `TODO` or `FIXME` near payment, transfer, FX, audit, or transaction logic:
  `LOW`, `ADVISORY`
- commented-out authentication or authorization bypass:
  `MEDIUM`, `HUMAN_REQUIRED`
- debug logging enabled in `appsettings.Production` or equivalent production
  config: `LOW`, `ADVISORY`
- missing rate-limiting marker on a financial endpoint:
  `MEDIUM`, `HUMAN_REQUIRED`

### Data Models

The persisted scan entity must not contain raw submitted content. Persist only
metadata plus redacted findings.

```csharp
public class ComplianceScan
{
    public Guid Id { get; set; }
    public string ContentType { get; set; } = null!; // CODE | DIFF | LOG | FREETEXT
    public string Source { get; set; } = null!;
    public int ContentLength { get; set; }
    public string SubmissionFingerprint { get; set; } = null!;
    public ScanDisposition Disposition { get; set; }
    public DateTime SubmittedAtUtc { get; set; }
    public DateTime CompletedAtUtc { get; set; }
    public ICollection<ComplianceFinding> Findings { get; set; } = [];
    public ICollection<OperatorDecision> Decisions { get; set; } = [];
}

public class ComplianceFinding
{
    public Guid Id { get; set; }
    public Guid ScanId { get; set; }
    public string RuleId { get; set; } = null!;
    public string Regulation { get; set; } = null!;
    public string Citation { get; set; } = null!;
    public string Category { get; set; } = null!;
    public string Description { get; set; } = null!;
    public string MatchedText { get; set; } = null!; // already redacted
    public int LineNumber { get; set; }
    public FindingSeverity Severity { get; set; }
    public FindingDisposition Disposition { get; set; }
    public string? HumanRequiredReason { get; set; }
    public ComplianceScan Scan { get; set; } = null!;
}

public class OperatorDecision
{
    public Guid Id { get; set; }
    public Guid ScanId { get; set; }
    public OperatorDecisionOutcome Decision { get; set; }
    public string Justification { get; set; } = null!;
    public string OperatorId { get; set; } = null!;
    public DateTime DecidedAtUtc { get; set; }
}

public enum ScanDisposition { AUTO_BLOCK, HUMAN_REQUIRED, ADVISORY }
public enum FindingSeverity { CRITICAL, HIGH, MEDIUM, LOW }
public enum FindingDisposition { AUTO_BLOCK, HUMAN_REQUIRED, ADVISORY }
public enum OperatorDecisionOutcome { APPROVED, REJECTED, ESCALATED }
```

### Acceptance Criteria

- [ ] A static rule library defines at least 20 rules and covers `PIPEDA`,
      `FINTRAC`, and `ADVISORY`
- [ ] Every rule carries a citation string that can be rendered in the UI
- [ ] `ComplianceScan`, `ComplianceFinding`, and `OperatorDecision` models
      exist
- [ ] `TicketDbContext` is extended with compliance entities
- [ ] No persisted compliance entity stores raw submitted content
- [ ] `dotnet build TicketDeflection.sln` succeeds and existing tests pass

## Feature 2: Scan Engine Service

Create the deterministic scan engine that applies the rule library to submitted
content and produces a structured result.

### Technical Notes

- The scan engine is stateless and should be registered as a singleton
- Scanning may be synchronous
- SIN detection must support `123 456 789`, `123-456-789`, and `123456789`
  while rejecting numbers starting with `0` or `8`
- Matched text must be redacted before persistence and before returning API
  responses
- Raw content is scanned in memory and discarded after the result is built
- A `SubmissionFingerprint` should be stored instead of raw content, for example
  a deterministic hash or other stable fingerprint
- Line numbers should be computed from newline positions in the original text

### Disposition Logic

After all rules run:

1. if any finding has disposition `AUTO_BLOCK`, the scan disposition is
   `AUTO_BLOCK`
2. else if any finding has severity `CRITICAL` or `HIGH`, the scan disposition
   is `HUMAN_REQUIRED`
3. else the scan disposition is `ADVISORY`

A clean scan with zero findings still returns overall disposition `ADVISORY`.

### Acceptance Criteria

- [ ] `ScanEngineService` exposes a method similar to
      `ScanContent(string content, string contentType, string source)`
- [ ] SIN matching accepts valid formats and rejects invalid prefixes
- [ ] Test-context content does not auto-block on fixture or unit-test examples
- [ ] Redaction never stores or returns a full SIN or card number
- [ ] A clean scan returns `ADVISORY` with zero findings
- [ ] `dotnet build TicketDeflection.sln` succeeds and existing tests pass

## Feature 3: Scan API Endpoints

Expose the scan engine and stored scan results through Minimal API endpoints.

### Endpoints

`POST /api/scans`

Request:

```json
{
  "content": "string",
  "contentType": "CODE | DIFF | LOG | FREETEXT",
  "source": "string"
}
```

Response `201`:

```json
{
  "scanId": "guid",
  "disposition": "AUTO_BLOCK | HUMAN_REQUIRED | ADVISORY",
  "findingCount": 3,
  "findings": [
    {
      "findingId": "guid",
      "ruleId": "PIPEDA-001",
      "regulation": "PIPEDA",
      "citation": "PIPEDA s.4.5",
      "category": "Personal Identifier Exposure",
      "description": "Social Insurance Number detected in plain text",
      "matchedText": "123***789",
      "lineNumber": 47,
      "severity": "CRITICAL",
      "disposition": "AUTO_BLOCK",
      "humanRequiredReason": null
    }
  ],
  "submittedAtUtc": "ISO8601",
  "completedAtUtc": "ISO8601"
}
```

`GET /api/scans?disposition=AUTO_BLOCK&limit=20&offset=0`

- list scans in reverse chronological order

`GET /api/scans/{id}`

- return a single scan with full finding details and any recorded operator
  decisions

`POST /api/scans/{id}/decision`

Request:

```json
{
  "decision": "APPROVED | REJECTED | ESCALATED",
  "justification": "string",
  "operatorId": "string"
}
```

Behavior:

- `200` for a recorded human decision on a `HUMAN_REQUIRED` scan
- `400` for `AUTO_BLOCK` scans
- `400` for `ADVISORY` scans
- `404` when the scan is not found

`GET /api/scans/metrics`

- returns total counts, pending-operator counts, and aggregates by regulation
  and severity

### Acceptance Criteria

- [ ] All required compliance endpoints are implemented in
      `ComplianceEndpoints.cs`
- [ ] `POST /api/scans` scans in memory, persists only redacted results, and
      returns `201`
- [ ] `POST /api/scans/{id}/decision` rejects `AUTO_BLOCK` and `ADVISORY`
      scans
- [ ] `HUMAN_REQUIRED` findings include `humanRequiredReason`
- [ ] No response DTO contains a remediation field for `HUMAN_REQUIRED`
      findings
- [ ] `dotnet build TicketDeflection.sln` succeeds and existing tests pass

## Feature 4: Seed Data and Simulation

Seed the service with realistic demo content and provide a simulation endpoint
that can repopulate the compliance queue quickly.

### Sample Library

Provide at least 15 sample snippets covering all of the following:

**PIPEDA violations**

- Python snippet logging a SIN during onboarding
- C# code logging date of birth
- JavaScript response with unmasked account numbers
- SQL query returning a full SIN
- Node.js error handler logging full profile data
- C# entity or DTO exposing a card number as a plain string

**FINTRAC violations**

- C# payment service handling CAD 15,000 with no reporting marker
- TypeScript transaction router bypassing suspicious-review flow
- financial record model missing audit markers
- wire transfer flow without beneficiary verification markers

**Advisory or ambiguous**

- `TODO` near financial calculation
- hardcoded test SIN in a test file or fixture that should not auto-block
- production config with debug logging enabled
- commented-out authentication middleware

**Clean**

- masked account-number formatter
- compliant FINTRAC reporting flow with required markers
- encrypted or tokenized SIN handling

### Demo Seeding

On app startup, if compliance data does not exist and demo seeding is enabled,
seed enough scans to make `/compliance` useful immediately. The startup seed
must create:

- one `AUTO_BLOCK` scan
- one pending `HUMAN_REQUIRED` scan
- one already-decided `HUMAN_REQUIRED` scan
- one advisory scan with findings
- one clean scan with zero findings

### Simulation Endpoint

`POST /api/scans/simulate?count=10`

- runs real sample content through the real scan engine
- persists the results
- returns aggregate counts
- defaults to `count=10`
- caps `count` at `50`

### Acceptance Criteria

- [ ] Sample content library contains at least 15 samples
- [ ] Startup seeding populates a useful first-load dashboard state
- [ ] The simulation endpoint uses the real scan engine
- [ ] Clean samples produce `ADVISORY` with zero findings
- [ ] Test-context samples do not auto-block
- [ ] `dotnet build TicketDeflection.sln` succeeds and existing tests pass

## Feature 5: Compliance Dashboard and Landing Integration

Create the dashboard page and connect it to the rest of the site navigation and
landing-page narrative.

### Compliance Dashboard

Add a Razor Page at `/compliance`.

Required sections, in this order:

1. metrics bar
2. `HUMAN DECISION REQUIRED`
3. `AUTO-BLOCKED`
4. recent scans
5. submit-for-scan panel

The `HUMAN DECISION REQUIRED` section must explain why the AI stopped. Each
item must show:

- regulation
- citation
- category
- severity
- source
- line number
- reason the AI stopped
- operator decision controls

The decision controls must post to `POST /api/scans/{id}/decision` and update
the page in place without a full reload.

For demo smoothness, the page should include a simple operator ID control with a
default such as `demo-operator`, and reuse that value for decisions.

The submit panel must:

- accept pasted content
- allow `CODE`, `DIFF`, `LOG`, or `FREETEXT`
- accept a source label
- post to `POST /api/scans`
- prepend the new result into the appropriate section immediately

Metrics and queue sections should refresh every 30 seconds using the same
vanilla JS style already used elsewhere in the app.

### Navigation and Landing Page

The site navigation is shared in the layout, so add the `compliance` link in
the shared navigation rather than editing page-specific nav fragments.

Add a landing-page specimen section above the existing specimen boundary copy:

```
// COMPLIANCE SCAN SERVICE - SPECIMEN OUTPUT

Scans code, diffs, and logs for PIPEDA and FINTRAC violations.
AUTO_BLOCK for clear violations. HUMAN_REQUIRED for anything
that needs legal sign-off. The AI classifies and stops.
A human decides.

[ Open Compliance Dashboard -> ]
```

Add this line to the landing-page framing:

> The pipeline now ships systems that know their own regulatory limits. The
> compliance service cannot determine remediation - it flags, classifies, and
> stops. That boundary is structural, not advisory.

### Acceptance Criteria

- [ ] `Pages/Compliance.cshtml` and its page model exist
- [ ] `/compliance` returns `200`
- [ ] `HUMAN DECISION REQUIRED` renders above `AUTO-BLOCKED`
- [ ] Human-required items show citation, stop reason, and decision buttons
- [ ] Decision actions update in place
- [ ] Submit-for-scan updates the page without a full reload
- [ ] Metrics refresh every 30 seconds
- [ ] The shared site navigation includes `compliance`
- [ ] The landing page includes the compliance specimen section and CTA
- [ ] `dotnet build TicketDeflection.sln` succeeds and existing tests pass

## Non-Functional Requirements

- All submitted content is scanned in memory and discarded after processing
- Persist only metadata, fingerprints, redacted finding excerpts, and human
  decisions
- `HUMAN_REQUIRED` findings structurally omit remediation fields
- `AUTO_BLOCK` cannot be overridden through the standard decision endpoint
- Rule definitions live in static code, not in the database
- No external API calls
- No ML inference
- InMemory data resets on restart
- Both the existing ticket deflection service and the new compliance service
  must coexist in the same app

## Out of Scope

- legal accuracy beyond deterministic demo rules
- authentication or real operator identity management
- persistent storage across restarts
- GitHub API integration or live PR ingestion
- PDF reports
- email or Slack notifications
- multi-tenant isolation
- a break-glass override endpoint
