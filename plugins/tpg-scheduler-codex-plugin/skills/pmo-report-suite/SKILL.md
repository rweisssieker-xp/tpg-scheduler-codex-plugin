---
name: pmo-report-suite
description: Use when creating PMO management reports, PMO report suites, filtered project portfolio reports, or DOCX/XLSX PMO outputs from real Dynamics 365 TPG project data.
---

# PMO Report Suite

Use this skill when the user asks for PMO reports, portfolio steering packs, management reports, Word reports, Excel reports, or any of the 12 PMO report types.

## Ground Rules

- Use real Dynamics 365 TPG project data or an explicit real project JSON export.
- Do not use sample, fixture, synthetic, or mock data for productive PMO reporting.
- Keep outputs advisory and evidence-backed.
- Do not save, submit, send, delete, change ownership, or change CRM state.
- If live Dynamics data is needed, use the authenticated Codex in-app Browser context and the `status-report` workflow rules for safe Dataverse reads.
- Write report files only to user-requested local paths such as `reports/*.docx` or `reports/*.xlsx`.

## Report Types

- `portfolio_steering`: executive steering view with top risks, decisions, and management attention.
- `decision_action_aging`: open decisions, actions, owners, due dates, and SLA aging.
- `project_health_trend`: project health movement using historical snapshots when available.
- `risk_issue_register`: evidence-backed risk and issue register.
- `dependency_constraint`: shared dependencies, vendor, interface, owner, and resource constraints.
- `resource_capacity`: resource risks, owner concentration, and PMO capacity signals.
- `milestone_baseline_drift`: milestone dates, baseline drift readiness, and delivery control.
- `budget_financial_risk`: budget risk, funding decisions, and scope tradeoff gaps.
- `status_quality_compliance`: status completeness, specificity, evidence, and quality warnings.
- `executive_exception`: only projects requiring CIO/CEO attention or unsafe/critical handling.
- `pmo_work_queue`: daily PMO review, coaching, escalation, and follow-up queue.
- `audit_writeback_safety`: CRM writeback simulations, confirmation analytics, and audit readiness.

## Commands

```powershell
cd plugins/tpg-scheduler-codex-plugin
node ./scripts/statusbericht.js --pmo-report <real-project-export.json> --pmo-report-type executive_exception --json
node ./scripts/statusbericht.js --pmo-suite <real-project-export.json> --json
node ./scripts/statusbericht.js --pmo-suite <real-project-export.json> --docx reports/pmo-suite.docx --xlsx reports/pmo-suite.xlsx
```

## Filters

Use these filters for individual reports or the full suite:

```powershell
--project-status "In Progress,Planning"
--last-status-before YYYY-MM-DD
--last-status-after YYYY-MM-DD
--last-status-on YYYY-MM-DD
--last-status-contains "vendor"
--last-status-missing
```

## Expected Output

Every report exposes:

- `reportType`
- `title`
- `generatedAt`
- `filters`
- `summary`
- `sections`
- `rows`
- `evidence`
- `dataGaps`

Missing optional fields must appear as `dataGaps`; never infer missing budget, resource, baseline, or history values.
