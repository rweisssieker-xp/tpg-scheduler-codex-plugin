---
name: pmo-report-suite
description: Run the TPG-Scheduler-Codex-Plugin PMO report suite from the repository root plugin entry.
---

# PMO Report Suite

Use this root skill entry when the plugin is installed from the repository root and the user asks for PMO reports, portfolio management reports, Word reports, Excel reports, or the 12 PMO report suite.

For USP or differentiation requests, also inspect `buildProjectIntelligence(...).maximumUsps` or `buildMaximumUspLayer(projects, options)`.
For PMO-specific USP requests, also inspect `buildProjectIntelligence(...).pmoUsps` or `buildPmoUspLayer(projects, options)`.

The implementation package, tests, and deeper documentation live in `plugins/tpg-scheduler-codex-plugin/`.

Prefer real D365 API input from the authenticated Dynamics browser. Generate the helper with `npm run status-report:dataverse`, then run `TPGProjectAssist.retrieveProjectIntelligenceFromD365()` or `TPGProjectAssist.retrieveBatchProjectPreviewFromD365()` in Dynamics.

## Local Commands

```powershell
cd plugins/tpg-scheduler-codex-plugin
npm run status-report:dataverse
node ./scripts/statusbericht.js --pmo-report <snapshot.json> --allow-offline-input --pmo-report-type executive_exception --json
node ./scripts/statusbericht.js --pmo-suite <snapshot.json> --allow-offline-input --json
node ./scripts/statusbericht.js --pmo-suite <snapshot.json> --allow-offline-input --docx reports/pmo-suite.docx --xlsx reports/pmo-suite.xlsx
npm test
```

## Report Types

`portfolio_steering`, `decision_action_aging`, `project_health_trend`, `risk_issue_register`, `dependency_constraint`, `resource_capacity`, `milestone_baseline_drift`, `budget_financial_risk`, `status_quality_compliance`, `executive_exception`, `pmo_work_queue`, `audit_writeback_safety`.

## Rules

- Use real project data only.
- Prefer live D365 API helper output from the authenticated Dynamics browser.
- Do not use sample, fixture, synthetic, or mock data for PMO work.
- Use local JSON only as an explicit offline fallback with `--allow-offline-input`.
- Treat missing optional fields as data gaps.
- Keep CRM write actions out of PMO report generation.
- Keep Maximum USP output advisory-only and evidence-backed.
- Keep PMO USP output advisory-only and evidence-backed.
