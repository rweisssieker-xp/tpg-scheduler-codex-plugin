---
name: pmo-report-suite
description: Run the TPG-Scheduler-Codex-Plugin PMO report suite from the repository root plugin entry.
---

# PMO Report Suite

Use this root skill entry when the plugin is installed from the repository root and the user asks for PMO reports, portfolio management reports, Word reports, Excel reports, or the 12 PMO report suite.

The implementation package, tests, and deeper documentation live in `plugins/tpg-scheduler-codex-plugin/`.

## Local Commands

```powershell
cd plugins/tpg-scheduler-codex-plugin
node ./scripts/statusbericht.js --pmo-report <real-project-export.json> --pmo-report-type executive_exception --json
node ./scripts/statusbericht.js --pmo-suite <real-project-export.json> --json
node ./scripts/statusbericht.js --pmo-suite <real-project-export.json> --docx reports/pmo-suite.docx --xlsx reports/pmo-suite.xlsx
npm test
```

## Report Types

`portfolio_steering`, `decision_action_aging`, `project_health_trend`, `risk_issue_register`, `dependency_constraint`, `resource_capacity`, `milestone_baseline_drift`, `budget_financial_risk`, `status_quality_compliance`, `executive_exception`, `pmo_work_queue`, `audit_writeback_safety`.

## Rules

- Use real project data only.
- Do not use sample, fixture, synthetic, or mock data for PMO work.
- Treat missing optional fields as data gaps.
- Keep CRM write actions out of PMO report generation.
