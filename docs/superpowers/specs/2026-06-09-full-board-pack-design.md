# Full Board Pack / Steering Pack Design

## Objective

Build a Full Board Pack / Steering Pack layer for the TPG-Scheduler-Codex-Plugin that maximizes management impact for PMO, CIO/CEO, and project leaders. The pack produces a management-ready Word document, an analysis-ready Excel workbook, and a machine-readable JSON payload.

Productive data must always be read from the authenticated Dynamics 365 / Dataverse API context through `Xrm.WebApi`. File-based snapshots are permitted only as explicit offline fallback for reviewed local snapshots and tests.

## Non-Negotiable Data Rule

All productive Board Pack data must come from D365 APIs:

```js
await TPGProjectAssist.retrieveBoardPackFromD365({ today: "YYYY-MM-DD" })
```

The implementation must not promote downloaded exports as a normal data source. Local JSON input may remain available only for tests, documentation fixtures, and reviewed offline fallback commands that require `--allow-offline-input`.

## Public APIs

Add these APIs:

```js
buildBoardPack(projects, options)
retrieveBoardPackFromD365(options)
writeBoardPackFiles(boardPack, { docxPath, xlsxPath })
```

Export `buildBoardPack` and `writeBoardPackFiles` from `scripts/statusbericht.js`. Expose `retrieveBoardPackFromD365` on `window.TPGProjectAssist` in the browser snippet.

## Board Pack Contract

The JSON payload should use this shape:

```js
{
  packType: "full_board_pack",
  source: "d365_api",
  generatedAt,
  executive: {},
  pmo: {},
  projectLeader: {},
  steeringAgenda: [],
  decisionLog: [],
  riskRegister: [],
  statusSuggestions: [],
  projectSpotlights: [],
  evidenceLedger: [],
  dataGaps: [],
  accessIssues: [],
  safety: {
    advisoryOnly: true,
    canAutoSave: false,
    crmWritesIncluded: false
  }
}
```

Required behavior:

- Use existing intelligence layers where possible: Project Safety Gates, PMO Control Tower, PMO Report Suite, Status Suggestion Report, PMO USPs, Maximum USPs, risk ledger, decision closure, evidence gap detector, and safe writeback simulations.
- Keep generated status and management wording review-only.
- Mark missing optional fields as `dataGaps`.
- Include project `recordUrl` wherever available.
- Include no CRM write operation in the Board Pack.

## D365 Live Data Flow

```text
Authenticated Dynamics Browser
  -> Xrm.WebApi
  -> retrieveBoardPackFromD365(options)
  -> retrievePmoProjectPortfolio(options)
  -> optional retrieveStatusUpdates(project, options)
  -> buildBoardPack(projects, options)
  -> JSON / DOCX / XLSX
```

If status-update metadata cannot be resolved, the pack must still generate from project portfolio data and report status history as a data gap or access issue.

## Target Audiences

The pack must serve three audiences in one shared structure and optional audience-specific outputs.

### Executive

For CIO/CEO steering:

- Portfolio snapshot.
- Top risks and exceptions.
- Open decisions and overdue actions.
- Executive questions.
- Management attention routing.
- No-surprise forecast.
- Board-level recommendations.

### PMO

For PMO control:

- PMO work queue.
- Safety gate summary.
- Control tower findings.
- Status quality and compliance.
- Data gaps and evidence ledger.
- Dependency and bottleneck signals.
- Audit/writeback safety view.

### Project Leader

For project leaders:

- Own project rows.
- Status suggestion text.
- `kv` eligibility.
- Missing data.
- Required next actions.
- Record links.
- Review-only writeback readiness.

## Word Board Pack

The Word output should be a management document, not a raw data dump.

Sections:

- Executive title page.
- Executive summary with portfolio KPIs.
- CIO/CEO top 10 risks and decisions.
- Steering agenda.
- PMO work queue.
- Project leader status suggestions.
- Project spotlights.
- Evidence and data gaps.

Visual behavior:

- Use a strong title band and subtitle.
- Use KPI cards and callouts.
- Use highlighted tables for critical/watch/safe signals.
- Use short, management-readable text.
- Include project links as visible URLs or link text where supported by the DOCX generator.

## Excel Board Workbook

The Excel workbook should be analysis-ready and visually polished.

Sheets:

- `Executive Dashboard`
- `PMO Control`
- `Project Leader Queue`
- `Steering Agenda`
- `Risks`
- `Decisions`
- `Status Suggestions`
- `Project Links`
- `Evidence`
- `Data Gaps`

Workbook behavior:

- Frozen headers.
- Autofilters.
- Stable column widths.
- Wrapped text.
- Signal colors for critical/watch/safe/green/yellow/red.
- Clickable `Open Project` hyperlinks when `recordUrl` exists.
- Empty link cells plus data gaps when record URLs are missing.

## CLI

Add offline fallback CLI only for reviewed snapshots:

```powershell
node ./scripts/statusbericht.js --board-pack <snapshot.json> --allow-offline-input --json
node ./scripts/statusbericht.js --board-pack <snapshot.json> --allow-offline-input --docx reports/board-pack.docx --xlsx reports/board-pack.xlsx
```

The help text must state that productive Board Pack data should come from:

```js
await TPGProjectAssist.retrieveBoardPackFromD365({ today: "YYYY-MM-DD" })
```

## Error Handling

- If `Xrm.WebApi` is unavailable, return or throw a clear message: `Open Dynamics and sign in first.`
- If status-update metadata cannot be resolved, continue with portfolio data and add a data gap.
- If project fields are missing, do not invent values; add data gaps.
- If record URLs are missing, leave link cells empty and add data gaps.
- If partial API reads fail, include `accessIssues` and continue with available data.
- DOCX and XLSX writing must be local file output only and must not perform CRM writes.

## Tests

Add or update tests for:

- `buildBoardPack` returns `packType: "full_board_pack"`.
- Board Pack contains `executive`, `pmo`, and `projectLeader`.
- Board Pack safety declares `canAutoSave: false` and `crmWritesIncluded: false`.
- `retrieveBoardPackFromD365` appears in the browser snippet.
- CLI `--board-pack` rejects file input unless `--allow-offline-input` or test sample mode is used.
- JSON output includes `source: "d365_api"` for the live helper and an explicit offline marker for fallback.
- DOCX contains executive summary, PMO queue, status suggestions, evidence, and data gaps.
- XLSX contains all Board Pack sheets.
- XLSX project sheets include real hyperlink relationships when `recordUrl` exists.
- Missing record URLs produce data gaps, not fake links.
- `npm test`, `npm run validate`, `npm run release:check`, and `npm audit --audit-level=moderate` pass.

## Documentation And Skills

Update:

- `README.md`: add Full Board Pack / Steering Pack feature.
- `docs/ARCHITECTURE.md`: document D365 API-only production data path and Board Pack layer.
- `docs/USAGE.md`: show live D365 call and offline fallback command.
- `docs/SCHEMA.md`: document Board Pack contract.
- `docs/VALIDATION.md`: document Board Pack tests.
- `docs/RELEASE_NOTES_v0.1.0.md`: add post-release note.
- `skills/status-report/SKILL.md`: use Board Pack only from D365 live data for productive management packs.
- `skills/pmo-report-suite/SKILL.md`: make Board Pack the preferred entry for CIO/CEO/PMO management packets.
- Root skill copies under `skills/`.

## Out Of Scope For First Implementation

- Direct CRM writes from the Board Pack.
- Automatic email distribution.
- Power BI deployment.
- Authentication outside the logged-in Dynamics browser context.
- Replacing the existing 12 PMO report suite.

## Acceptance Criteria

- Productive Board Pack generation is D365 API-first and exposed through `retrieveBoardPackFromD365`.
- Offline file input remains explicit fallback only.
- Word and Excel files are management-ready and audience-separated.
- Excel includes clickable project hyperlinks where D365 record URLs exist.
- Missing data is visible as `dataGaps`.
- All generated text is review-only.
- Local validation and GitHub CI pass.
