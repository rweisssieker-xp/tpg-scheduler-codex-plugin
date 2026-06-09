---
name: pmo-report-suite
description: Use when creating PMO management reports, PMO report suites, filtered project portfolio reports, or DOCX/XLSX PMO outputs from real Dynamics 365 TPG project data.
---

# PMO Report Suite

Use this skill when the user asks for PMO reports, portfolio steering packs, management reports, Word reports, Excel reports, or any of the 12 PMO report types.

If the user asks for USPs, differentiation, CIO/CEO value, or maximum product value, use `buildProjectIntelligence(...).maximumUsps` or `buildMaximumUspLayer(projects, options)` alongside the PMO reports.
If the user asks for PMO-specific USPs, operational PMO value, steering committee preparation, audit readiness, or PMO work queues, use `buildProjectIntelligence(...).pmoUsps` or `buildPmoUspLayer(projects, options)`.

## Ground Rules

- Use real Dynamics 365 TPG project data from the authenticated D365 API context.
- Prefer direct D365 API helpers from the authenticated Dynamics browser: `TPGProjectAssist.retrieveProjectIntelligenceFromD365()`, `retrieveBatchProjectPreviewFromD365()`, `retrieveMonthlyStatusPlanFromD365()`, `buildLivePmoControlCenterFromD365()`, `retrieveExecutiveSteeringPackFromD365()`, or `retrievePmoDataGapWorklistFromD365()`.
- For automatic status wording, use `TPGProjectAssist.retrieveStatusSuggestionReportFromD365()` or offline fallback `--status-suggestion-report`.
- Do not use sample, fixture, synthetic, or mock data for productive PMO reporting.
- Keep outputs advisory and evidence-backed.
- Do not save, submit, send, delete, change ownership, or change CRM state.
- If live Dynamics data is needed, use the authenticated Codex in-app Browser context and the `status-report` workflow rules for safe Dataverse reads.
- Accept local JSON only as an explicit offline fallback snapshot with `--allow-offline-input`.
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

## Maximum USPs

The PMO report suite can be paired with the 12 Maximum USPs:

- PMO Safety Radar
- Executive No-Surprise Brief
- Status Truth Audit
- Monthly Writeback Guard
- Decision Debt Ledger
- Evidence-Backed PMO Reports
- Dependency Blast Radius
- Project Manager Readiness Score
- CIO/CFO Risk Split
- Audit-Safe AI Recommendation
- Portfolio Work Queue
- CRM Writeback Simulation

## 15 PMO USPs

The PMO report suite can also be paired with `pmoUsps`:

- PMO Command Queue
- Steering Committee Auto-Pack
- Decision SLA Enforcement
- Risk Aging Memory
- PM Quality Coaching
- Portfolio Bottleneck Detector
- Governance Exception Radar
- PMO Data Quality Score
- Executive Attention Routing
- Baseline Drift Watch
- Writeback Audit Shield
- PMO Evidence Ledger
- No-Surprise Portfolio Forecast
- Dependency Blast Radius
- PMO Board Pack Diff

## Commands

```powershell
cd plugins/tpg-scheduler-codex-plugin
npm run status-report:dataverse
// In the authenticated Dynamics browser:
await TPGProjectAssist.retrieveProjectIntelligenceFromD365({ today: "YYYY-MM-DD" })
await TPGProjectAssist.retrieveStatusSuggestionReportFromD365({ today: "YYYY-MM-DD" })
await TPGProjectAssist.buildLivePmoControlCenterFromD365({ today: "YYYY-MM-DD" })
await TPGProjectAssist.retrieveExecutiveSteeringPackFromD365({ today: "YYYY-MM-DD" })
await TPGProjectAssist.retrievePowerBiReadyPortfolioFromD365({ today: "YYYY-MM-DD" })
node ./scripts/statusbericht.js --pmo-report <snapshot.json> --allow-offline-input --pmo-report-type executive_exception --json
node ./scripts/statusbericht.js --pmo-suite <snapshot.json> --allow-offline-input --json
node ./scripts/statusbericht.js --status-suggestion-report <snapshot.json> --allow-offline-input --docx reports/status-suggestions.docx --xlsx reports/status-suggestions.xlsx
node ./scripts/statusbericht.js --pmo-suite <snapshot.json> --allow-offline-input --docx reports/pmo-suite.docx --xlsx reports/pmo-suite.xlsx
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
