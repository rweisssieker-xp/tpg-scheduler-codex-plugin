# Usage

## Prerequisites

- Codex Desktop with the Browser plugin available.
- Access to the target Dynamics 365 environment.
- Permission to read relevant `tpg_project` records.
- Node.js available for local tests and offline intelligence commands.

## Offline Intelligence

Run the sample intelligence report:

```powershell
cd plugins/tpg-scheduler-codex-plugin
npm run statusbericht:intelligence
```

Emit machine-readable JSON:

```powershell
node ./scripts/statusbericht.js --intelligence ./scripts/fixtures/projects.sample.json --json
```

Emit CSV-ready export payloads:

```powershell
node ./scripts/statusbericht.js --intelligence ./scripts/fixtures/projects.sample.json --exports
```

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
npm run statusbericht:help
npm run statusbericht:dataverse
npm run statusbericht:intelligence
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
- Risk ledger rows.
- PMO nudges and manual review drafts.
- JSON intelligence pack.
- CSV strings for management actions and risk ledger exports.
