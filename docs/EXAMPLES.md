# Examples

## Offline Intelligence

```powershell
cd plugins/tpg-scheduler-codex-plugin
node ./scripts/statusbericht.js --intelligence <real-project-export.json>
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
node ./scripts/statusbericht.js --intelligence <real-project-export.json> --json
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
node ./scripts/statusbericht.js --intelligence <real-project-export.json> --exports
```

The export payload includes CSV strings for:

- management actions
- risk ledger

It also includes the full JSON intelligence payload for downstream automation.

## PMO Filtered Report

```powershell
node ./scripts/statusbericht.js --pmo-report <real-project-export.json> --project-status "In Progress" --last-status-before 2026-06-01
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
node ./scripts/statusbericht.js --pmo-report <real-project-export.json> --project-status "In Progress,Planning" --last-status-missing --json
```

## Schema-Aware Consumers

Consumer tools should start with:

- `schemas/project-intelligence.schema.json`
- `schemas/project-safety-gates.schema.json`
- `schemas/pmo-control-tower.schema.json`

The schemas are stable enough for dashboards, PMO review queues, release checks, and executive reporting, while allowing future advisory fields.
