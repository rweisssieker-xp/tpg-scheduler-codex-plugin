# Usage

## Prerequisites

- Codex Desktop with the Browser plugin available.
- Access to the target Dynamics 365 environment.
- Permission to read relevant `tpg_project` records.
- Node.js available for local tests and offline intelligence commands.

## Offline Intelligence

Run an intelligence report from a real project export:

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

The DOCX contains a PMO executive title band, KPI snapshot, filter table, summary table, and highlighted project table. The XLSX workbook contains styled worksheets for summary, filters, filtered projects, and PMO findings with frozen headers, widths, filters, and risk/status highlighting.

## Dynamics Browser Workflow

1. Start the `status-report` skill in Codex.
2. Open the configured Dynamics 365 TPG project view in the in-app Browser.
3. Read candidate active projects from Dataverse when the authenticated page context allows it.
4. Open each candidate project record and verify `Project Manager`.
5. Build a status preview and project intelligence pack.
6. Collect one status input per verified project.
7. Stage a Quick Create status update only after review.
8. Save only after explicit confirmation of project, status text, and email setting.

## Important Commands

```powershell
npm run status-report:help
npm run status-report:dataverse
node ./scripts/statusbericht.js --intelligence <real-project-export.json>
node ./scripts/statusbericht.js --pmo-report <real-project-export.json>
npm test
```

## Data Inputs

Offline intelligence expects a JSON array of mapped project objects. Common fields:

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
