# Usage

## Prerequisites

- Codex Desktop with the Browser plugin available.
- Access to the target Dynamics 365 environment.
- Permission to read relevant `tpg_project` records.
- Node.js available for local tests and explicit offline fallback commands.

## Offline Intelligence

The preferred production input is always live D365 API data from the authenticated Dynamics browser context. Direct JSON arrays or local snapshots are accepted only as an explicit offline fallback with `--allow-offline-input`.

Install the D365 API helper after signing in to Dynamics:

```powershell
npm run status-report:dataverse
```

Paste the printed snippet into the authenticated Dynamics browser console, then run one of these read-only D365 API helpers:

```javascript
await TPGProjectAssist.retrieveProjectIntelligenceFromD365({ today: "YYYY-MM-DD" })
await TPGProjectAssist.retrieveBatchProjectPreviewFromD365({ today: "YYYY-MM-DD" })
await TPGProjectAssist.retrieveMonthlyStatusPlanFromD365({ month: "YYYY-MM", statusText: "kv" })
```

These helpers read through `Xrm.WebApi` and do not create CRM writes or require a downloaded export file.

Offline fallback from a reviewed local snapshot:

```powershell
cd plugins/tpg-scheduler-codex-plugin
node ./scripts/statusbericht.js --intelligence <snapshot.json> --allow-offline-input
```

Emit machine-readable JSON:

```powershell
node ./scripts/statusbericht.js --intelligence <snapshot.json> --allow-offline-input --json
```

The JSON includes `maximumUsps`, a 12-item Maximum USP Layer with implementation status, proof metrics, runtime signals, required data, trust controls, and USP scores.
It also includes `pmoUsps`, a 15-item PMO USP Layer with operational PMO command queues, evidence ledger entries, data gaps, runtime signals, proof metrics, and advisory-only trust controls.

Emit CSV-ready export payloads:

```powershell
node ./scripts/statusbericht.js --intelligence <snapshot.json> --allow-offline-input --exports
```

Sample and synthetic files are blocked by default and are reserved for automated tests and documentation fixtures.

## PMO Report Filters

For production PMO data, use the D365 API helpers in the authenticated browser. File-based PMO report commands are offline fallback only:

```powershell
node ./scripts/statusbericht.js --pmo-report <snapshot.json> --allow-offline-input
```

Create one of the 12 PMO management reports:

```powershell
node ./scripts/statusbericht.js --pmo-report <snapshot.json> --allow-offline-input --pmo-report-type executive_exception --json
```

Create the complete 12-report suite:

```powershell
node ./scripts/statusbericht.js --pmo-suite <snapshot.json> --allow-offline-input --docx reports/pmo-suite.docx --xlsx reports/pmo-suite.xlsx --json
```

Use the `pmo-report-suite` skill for PMO reports and the `status-report` skill for Dynamics status-entry work.

Filter by project status:

```powershell
node ./scripts/statusbericht.js --pmo-report <snapshot.json> --allow-offline-input --project-status "In Progress"
```

Filter by multiple project statuses:

```powershell
node ./scripts/statusbericht.js --pmo-report <snapshot.json> --allow-offline-input --project-status "In Progress,Planning"
```

Filter by the last status report:

```powershell
node ./scripts/statusbericht.js --pmo-report <snapshot.json> --allow-offline-input --last-status-before 2026-06-01
node ./scripts/statusbericht.js --pmo-report <snapshot.json> --allow-offline-input --last-status-after 2026-05-01
node ./scripts/statusbericht.js --pmo-report <snapshot.json> --allow-offline-input --last-status-on 2026-05-15
node ./scripts/statusbericht.js --pmo-report <snapshot.json> --allow-offline-input --last-status-contains "vendor"
node ./scripts/statusbericht.js --pmo-report <snapshot.json> --allow-offline-input --last-status-missing
```

Emit the filtered PMO report as JSON:

```powershell
node ./scripts/statusbericht.js --pmo-report <snapshot.json> --allow-offline-input --project-status "In Progress" --json
```

Write the PMO report as Word and Excel files:

```powershell
node ./scripts/statusbericht.js --pmo-report <snapshot.json> --allow-offline-input --project-status "In Progress" --docx reports/pmo-status.docx --xlsx reports/pmo-status.xlsx
```

The DOCX contains a PMO executive title band, subtitle band, executive-attention callout, KPI snapshot cards, filter-scope callout, status legend, project spotlight, summary table, and highlighted project table. The XLSX workbook contains styled worksheets for summary, filters, filtered projects, and PMO findings with frozen headers, widths, filters, and risk/status highlighting.

Supported `--pmo-report-type` values are `portfolio_steering`, `decision_action_aging`, `project_health_trend`, `risk_issue_register`, `dependency_constraint`, `resource_capacity`, `milestone_baseline_drift`, `budget_financial_risk`, `status_quality_compliance`, `executive_exception`, `pmo_work_queue`, and `audit_writeback_safety`.

## Dynamics Browser Workflow

1. Start the `status-report` skill in Codex.
2. Open the configured Dynamics 365 TPG project view in the in-app Browser.
3. Read candidate active projects from Dataverse when the authenticated page context allows it.
4. Open each candidate project record and verify `Project Manager`.
5. Build a status preview and project intelligence pack.
6. Collect one status input per verified project.
7. Stage a Quick Create status update only after review.
8. Save only after explicit confirmation of project, status text, and email setting.

## Monthly Project-Leader Status Writeback

Project leaders should prepare monthly status plans directly from the D365 API in the authenticated browser:

```powershell
await TPGProjectAssist.retrieveMonthlyStatusPlanFromD365({ month: "2026-06" })
```

To prefill every active project with the unchanged-status shortcut for review:

```powershell
await TPGProjectAssist.retrieveMonthlyStatusPlanFromD365({ month: "2026-06", statusText: "kv", projectManagerVerified: true, reviewed: true })
```

The output contains one monthly draft per project, the report period, prepared Status Update fields, project safety level, writeback risk, blockers, and the exact confirmation text required before saving. It does not auto-save. The safe write path remains:

1. Open the verified project record.
2. Open `Status Update` and choose `New Status Update`.
3. Stage the prepared fields in `Quick Create: Status Update`.
4. Verify `Submitted To` and `Email Status Update`.
5. Save only after explicit confirmation for the exact project, month, status text, and email setting.

## Status API Max Layer

The status API layer exposes these integration helpers for real Dynamics workflows:

- `retrieveAllRecords`: paginated Dataverse reads.
- `retrieveProjectDelta`: active project changes since `modifiedon`.
- `retrieveStatusUpdates`: status history by project and month.
- `discoverStatusUpdateMetadata`: entity metadata, entity set, attributes, and privileges.
- `probeDataversePermissions`: read and metadata-based write readiness probe without creating data.
- `buildStructuredStatusUpdateDraft`: structured fields for current status, next steps, risks, decisions, and sponsor actions.
- `buildStatusUpdateDuplicateCheck`: duplicate detection for project/month.
- `buildStatusReportIdempotencyKey`: stable key for project/month/status.
- `validateMonthlyStatusDraft`: required field, duplicate, and writeback blocker validation.
- `buildStatusWritebackQueue`: bulk monthly writeback queue with proposed/blocked states.
- `buildStatusUpdateCreateRecordPlan`: confirmation-gated Dataverse create plan.
- `createStatusUpdateWithConfirmation`: browser-context `Xrm.WebApi.createRecord`, only when the exact confirmation text matches.
- `buildStatusWritebackAuditEvent`: audit event for proposed, staged, saved, skipped, or failed actions.
- `buildStatusUpdateAttachmentPlan`: explicit-confirmation plan for linking DOCX/XLSX/JSON artifacts.
- `mapDataverseError`: translates Dataverse errors into actionable categories.

## D365 API Max Features

The browser snippet also exposes 15 API-first helpers for PMO and monthly status operations. They all run inside the authenticated Dynamics browser context and use `Xrm.WebApi` or Dataverse metadata APIs:

- `discoverProjectFieldMetadataFromD365`: live project field discovery.
- `buildLivePmoControlCenterFromD365`: PMO control center with safety levels, risks, command queue, agenda, and gaps.
- `resolveStatusUpdateEntityFromD365`: Status Update entity resolver.
- `retrieveMonthlyPmSelfServiceFlowFromD365`: monthly project-leader self-service flow with duplicate checks and writeback queue.
- `simulateStatusWritebackFromD365`: dry-run create plan with metadata and duplicate validation.
- `resolveSubmittedToCandidatesFromD365`: real `systemuser` lookup candidates for `Submitted To`.
- `retrieveStatusHistoryTimelineFromD365`: status history timeline by project.
- `checkDuplicateStatusUpdateFromD365`: duplicate prevention for project/month.
- `retrieveExecutiveSteeringPackFromD365`: executive pack from live portfolio data.
- `retrievePmoDataGapWorklistFromD365`: PMO worklist for missing evidence.
- `routeCioCfoRiskFromD365`: CIO/CFO/CEO/PMO risk routing.
- `retrievePowerBiReadyPortfolioFromD365`: table-shaped JSON for Power BI/Fabric ingestion.
- `probeD365PermissionsDetailed`: project, status, user lookup, and current-user permission probe.
- `buildAuditEvidencePackFromD365`: audit evidence pack from live intelligence.
- `pilotStatusWritebackFromD365`: safe pilot mode; dry-run by default and create only with exact confirmation.

## Important Commands

```powershell
npm run status-report:help
npm run status-report:dataverse
node ./scripts/statusbericht.js --intelligence <snapshot.json> --allow-offline-input
node ./scripts/statusbericht.js --monthly-status-plan <snapshot.json> --allow-offline-input --month YYYY-MM --json
node ./scripts/statusbericht.js --pmo-report <snapshot.json> --allow-offline-input
npm test
```

## Data Inputs

Offline fallback accepts either a reviewed Dataverse snapshot envelope or a JSON array of mapped project objects, and requires `--allow-offline-input`. Common project fields:

- `projectId`
- `name`
- `projectStatusLabel`
- `overallKpiLabel`
- `progress`
- `finish`
- `lastStatusUpdate`
- `currentStatusText`
- `obstaclesAndMeasures`
- `decisions`
- `sponsorActions`

## Output Types

- Markdown executive one-pager.
- Project leader status queue.
- Portfolio risk list.
- Decision radar and decision SLA cockpit.
- Project Safety Gates with safety level, management attention, writeback risk, required evidence, and recommended actions.
- Monthly status writeback plans with per-project draft fields, confirmation text, and Quick Create writeback blockers.
- PMO Control Tower output with 25 governance and portfolio-control checks per project.
- PMO Status Report output with filters for project status and last status report date/text.
- Maximum USP Layer with 12 implemented differentiators and runtime proof metrics.
- 15 PMO USP Layer with command queue, evidence ledger, board-pack diff readiness, and data gaps.
- DOCX and XLSX PMO report files.
- Risk ledger rows.
- PMO nudges and manual review drafts.
- JSON intelligence pack.
- CSV strings for management actions and risk ledger exports.

Use `projectSafetyGates.summary` in JSON output to see portfolio-level safety counts and `projectSafetyGates.projects[*].gates` to inspect the advisory checks for a specific project.

Use `pmoControlTower.summary` to see PMO workload and `pmoControlTower.projects[*].checks` to inspect the 25 PMO routines for one project.

Use `maximumUsps.summary` to see how many differentiators are implemented and ready, and `maximumUsps.usps[*]` to inspect the technical mechanism, required data, trust controls, proof metric, and runtime signals behind each USP.

Use `pmoUsps.summary` to inspect operational PMO value, `pmoUsps.commandQueue` for prioritized PMO work, `pmoUsps.evidenceLedger` for audit evidence, and `pmoUsps.dataGaps` for missing snapshot, baseline, report, or evidence inputs.

## Stable Contracts

Machine-readable contracts are stored in `schemas/`:

- `project-intelligence.schema.json`
- `project-safety-gates.schema.json`
- `pmo-control-tower.schema.json`

A compact synthetic JSON example is available at `examples/project-intelligence.sample.json` for documentation and consumer tests only. It is not accepted by productive CLI runs.

## Live Verification

Use `docs/DYNAMICS_E2E_RUNBOOK.md` before a release or after changing browser-field mapping. The runbook keeps the test read-only until explicit confirmation is required for a controlled draft-staging check.
