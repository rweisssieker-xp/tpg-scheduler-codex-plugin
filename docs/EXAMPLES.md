# Examples

## Offline Intelligence

```powershell
cd plugins/tpg-scheduler-codex-plugin
npm run status-report:intelligence
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
node ./scripts/statusbericht.js --intelligence ./scripts/fixtures/projects.sample.json --json
```

The JSON payload includes:

- `preview`
- `portfolioRisks`
- `decisionClosureItems`
- `riskLedger`
- `decisionDebtAnalysis`
- `projectTruthScores`
- `evidenceGapDetector`
- `executiveQuestionGenerator`
- `reportQualityBenchmark`

## Export Payload

```powershell
node ./scripts/statusbericht.js --intelligence ./scripts/fixtures/projects.sample.json --exports
```

The export payload includes CSV strings for:

- management actions
- risk ledger

It also includes the full JSON intelligence payload for downstream automation.
