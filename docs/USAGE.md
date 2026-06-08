# Usage

## Prerequisites

- Codex Desktop with the Browser plugin available.
- Access to the target Dynamics 365 environment.
- Permission to read relevant `tpg_project` records.
- Node.js available for local tests and offline intelligence commands.

## Offline Intelligence

The preferred input is a real Dataverse PMO project export created from the authenticated Dynamics browser context. A direct JSON array of mapped projects is still accepted for controlled offline workflows.

Create a Dataverse-first export after signing in to Dynamics:

```powershell
npm run status-report:dataverse
```

Paste the printed snippet into the authenticated Dynamics browser console, then run one of these read-only helpers:

```javascript
await TPGProjectAssist.downloadPmoProjectExport()
await TPGProjectAssist.copyPmoProjectExportToClipboard()
```

The export has `exportType: "tpg_pmo_project_export"`, `source: "dataverse_web_api"`, source metadata, and a `projects` array. It contains no CRM writes and no mock data.

Run an intelligence report from a real Dataverse export:

```powershell
cd plugins/tpg-scheduler-codex-plugin
node ./scripts/statusbericht.js --intelligence <real-project-export.json>
```

Emit machine-readable JSON:

```powershell
node ./scripts/statusbericht.js --intelligence <real-project-export.json> --json
```

Emit CSV-ready export payloads:

```powershell
node ./scripts/statusbericht.js --intelligence <real-project-export.json> --exports
```

Sample and synthetic files are blocked by default and are reserved for automated tests and documentation fixtures.

## PMO Report Filters

Create a PMO report from real project export data:

```powershell
node ./scripts/statusbericht.js --pmo-report <real-project-export.json>
```

Create one of the 12 PMO management reports:

```powershell
node ./scripts/statusbericht.js --pmo-report <real-project-export.json> --pmo-report-type executive_exception --json
```

Create the complete 12-report suite:

```powershell
node ./scripts/statusbericht.js --pmo-suite <real-project-export.json> --docx reports/pmo-suite.docx --xlsx reports/pmo-suite.xlsx --json
```

Use the `pmo-report-suite` skill for PMO reports and the `status-report` skill for Dynamics status-entry work.

Filter by project status:

```powershell
node ./scripts/statusbericht.js --pmo-report <real-project-export.json> --project-status "In Progress"
```

Filter by multiple project statuses:

```powershell
node ./scripts/statusbericht.js --pmo-report <real-project-export.json> --project-status "In Progress,Planning"
```

Filter by the last status report:

```powershell
node ./scripts/statusbericht.js --pmo-report <real-project-export.json> --last-status-before 2026-06-01
node ./scripts/statusbericht.js --pmo-report <real-project-export.json> --last-status-after 2026-05-01
node ./scripts/statusbericht.js --pmo-report <real-project-export.json> --last-status-on 2026-05-15
node ./scripts/statusbericht.js --pmo-report <real-project-export.json> --last-status-contains "vendor"
node ./scripts/statusbericht.js --pmo-report <real-project-export.json> --last-status-missing
```

Emit the filtered PMO report as JSON:

```powershell
node ./scripts/statusbericht.js --pmo-report <real-project-export.json> --project-status "In Progress" --json
```

Write the PMO report as Word and Excel files:

```powershell
node ./scripts/statusbericht.js --pmo-report <real-project-export.json> --project-status "In Progress" --docx reports/pmo-status.docx --xlsx reports/pmo-status.xlsx
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

Project leaders can prepare one status report per active project and month from a real Dataverse export:

```powershell
node ./scripts/statusbericht.js --monthly-status-plan <real-project-export.json> --month 2026-06 --json
```

To prefill every active project with the unchanged-status shortcut for review:

```powershell
node ./scripts/statusbericht.js --monthly-status-plan <real-project-export.json> --month 2026-06 --status-text "kv" --project-manager-verified --reviewed --json
```

The output contains one monthly draft per project, the report period, prepared Status Update fields, project safety level, writeback risk, blockers, and the exact confirmation text required before saving. It does not auto-save. The safe write path remains:

1. Open the verified project record.
2. Open `Status Update` and choose `New Status Update`.
3. Stage the prepared fields in `Quick Create: Status Update`.
4. Verify `Submitted To` and `Email Status Update`.
5. Save only after explicit confirmation for the exact project, month, status text, and email setting.

## Important Commands

```powershell
npm run status-report:help
npm run status-report:dataverse
node ./scripts/statusbericht.js --intelligence <real-project-export.json>
node ./scripts/statusbericht.js --monthly-status-plan <real-project-export.json> --month YYYY-MM --json
node ./scripts/statusbericht.js --pmo-report <real-project-export.json>
npm test
```

## Data Inputs

Offline intelligence accepts either a Dataverse PMO project export envelope or a JSON array of mapped project objects. Common project fields:

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
- DOCX and XLSX PMO report files.
- Risk ledger rows.
- PMO nudges and manual review drafts.
- JSON intelligence pack.
- CSV strings for management actions and risk ledger exports.

Use `projectSafetyGates.summary` in JSON output to see portfolio-level safety counts and `projectSafetyGates.projects[*].gates` to inspect the advisory checks for a specific project.

Use `pmoControlTower.summary` to see PMO workload and `pmoControlTower.projects[*].checks` to inspect the 25 PMO routines for one project.

## Stable Contracts

Machine-readable contracts are stored in `schemas/`:

- `project-intelligence.schema.json`
- `project-safety-gates.schema.json`
- `pmo-control-tower.schema.json`

A compact synthetic JSON example is available at `examples/project-intelligence.sample.json` for documentation and consumer tests only. It is not accepted by productive CLI runs.

## Live Verification

Use `docs/DYNAMICS_E2E_RUNBOOK.md` before a release or after changing browser-field mapping. The runbook keeps the test read-only until explicit confirmation is required for a controlled draft-staging check.
