# Examples

## Offline Intelligence

```powershell
cd plugins/tpg-scheduler-codex-plugin
node ./scripts/statusbericht.js --intelligence <snapshot.json> --allow-offline-input
```

Example output shape:

```markdown
# Project Portfolio One-Pager

Audience: CEO/CIO
Projects reviewed: 2
Projects needing attention: 1
Projects OK: 1

## Portfolio Risks
- ERP Cutover (2024-9999): Overall KPI is Red. Finish date is overdue.

## Decisions And Sponsor Actions
- ERP Cutover (2024-9999): Approve fallback interface.
```

## JSON Intelligence

```powershell
node ./scripts/statusbericht.js --intelligence <snapshot.json> --allow-offline-input --json
```

The JSON payload includes:

- `preview`
- `portfolioRisks`
- `decisionClosureItems`
- `riskLedger`
- `projectSafetyGates`
- `pmoControlTower`
- `decisionDebtAnalysis`
- `projectTruthScores`
- `evidenceGapDetector`
- `executiveQuestionGenerator`
- `reportQualityBenchmark`

A compact synthetic sample is stored at `examples/project-intelligence.sample.json` for documentation and consumer tests only. Productive CLI runs reject sample and fixture paths.

## Export Payload

```powershell
node ./scripts/statusbericht.js --intelligence <snapshot.json> --allow-offline-input --exports
```

The export payload includes CSV strings for:

- management actions
- risk ledger

It also includes the full JSON intelligence payload for downstream automation.

## PMO Filtered Report

```powershell
node ./scripts/statusbericht.js --pmo-report <snapshot.json> --allow-offline-input --project-status "In Progress" --last-status-before 2026-06-01
```

The PMO report includes:

- selected filters
- total and matched project counts
- project status counts
- missing and unparsable last status report counts
- filtered project rows with PMO level, PMO score, intervention, and safety level
- PMO Control Tower summary for the filtered project set

Use JSON for dashboard or PMO queue consumers:

```powershell
node ./scripts/statusbericht.js --pmo-report <snapshot.json> --allow-offline-input --project-status "In Progress,Planning" --last-status-missing --json
```

Generate PMO Word and Excel files:

```powershell
node ./scripts/statusbericht.js --pmo-report <snapshot.json> --allow-offline-input --project-status "In Progress" --docx reports/pmo-status.docx --xlsx reports/pmo-status.xlsx
```

The generated files are intended for PMO review: the Word report uses a management-style title section, executive callouts, KPI cards, status legend, and project spotlight; the Excel workbook includes styled worksheets, filterable project rows, and highlighted PMO/safety levels.

## PMO Report Suite

```powershell
node ./scripts/statusbericht.js --pmo-suite <snapshot.json> --allow-offline-input --docx reports/pmo-suite.docx --xlsx reports/pmo-suite.xlsx --json
```

Create a single dedicated report:

```powershell
node ./scripts/statusbericht.js --pmo-report <snapshot.json> --allow-offline-input --pmo-report-type decision_action_aging --json
```

## Schema-Aware Consumers

Consumer tools should start with:

- `schemas/project-intelligence.schema.json`
- `schemas/project-safety-gates.schema.json`
- `schemas/pmo-control-tower.schema.json`
- `schemas/status-api-envelope.schema.json`
- `schemas/status-writeback-queue.schema.json`
- `schemas/status-update-create-plan.schema.json`
- `schemas/status-writeback-audit-event.schema.json`
- `schemas/status-update-duplicate-check.schema.json`

The schemas are stable enough for dashboards, PMO review queues, release checks, and executive reporting, while allowing future advisory fields.

## Status API Max Layer

The documentation-only sample at `examples/status-api-max.sample.json` shows:

- versioned Status API envelope
- monthly writeback queue
- duplicate-found result
- confirmation-gated Dataverse create plan
- writeback audit event

Productive Status API runs must use authenticated D365 API data. Local snapshots are offline fallback only and require explicit review; the sample contains synthetic identifiers and must not be used for CRM writes.
