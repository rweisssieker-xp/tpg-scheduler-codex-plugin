# TPG-Scheduler-Codex-Plugin

TPG-Scheduler-Codex-Plugin is a Codex plugin for confirmation-gated Dynamics 365 TPG project status reporting. It helps project leaders and PMO stakeholders prepare status drafts, risk evidence, decision follow-ups, escalation packs, and executive portfolio summaries while keeping CRM writes under explicit human control.

## What It Does

- Opens and reviews active Dynamics 365 TPG project candidates through the Codex in-app Browser workflow.
- Reads project portfolio data directly through the authenticated Dynamics `Xrm.WebApi` context; local JSON snapshots are only an explicit offline fallback.
- Verifies that the opened project record belongs to the configured project manager before status work continues.
- Normalizes short `kv` input to the configured unchanged-status phrase used in the target Dynamics environment.
- Builds project intelligence packs with evidence-backed risk, decision, PMO, and executive views.
- Exposes a Maximum USP Layer with 12 implemented, evidence-backed differentiators for PMO, CIO, CEO, project-leader, and audit workflows.
- Exposes a 15 PMO USP Layer that turns PMO findings into command queues, steering packs, SLA enforcement, evidence ledgers, and board-pack diffs.
- Stages status update drafts only after review and never saves, submits, sends, deletes, or changes CRM state without explicit confirmation.

## Core USPs

- Dataverse-first, browser-authenticated project data access without separate service-principal setup.
- Confirmation-gated monthly Status Update creation for project leaders, including duplicate checks, idempotency, audit events, and exact confirmation text.
- PMO-ready DOCX/XLSX/JSON reporting with filters, management styling, and 12 dedicated report types.
- Maximum Project Safety Gates across data integrity, status truth, delivery, governance, finance/resources, escalation, report quality, and writeback safety.
- Status API Max Layer for metadata discovery, permission probes, status history, delta reads, writeback queues, schemas, and Dataverse error mapping.
- Maximum USP Layer with 12 concrete, technically implemented differentiators exposed as `maximumUsps` in the project intelligence JSON.
- 15 PMO USP Layer exposed as `pmoUsps` for operational PMO steering, escalation, audit, quality, and evidence workflows.
- Public-repo safety posture: no mock data in productive commands, no automatic CRM writes, no secrets, and synthetic examples only.

## AI/KI Differentiators

- Maximum Project Safety Gates: evaluates every project across data integrity, status truth, delivery risk, governance, financial/resource risk, escalation readiness, report quality, and CRM writeback safety.
- PMO Control Tower: runs 25 PMO governance, accountability, aging, portfolio concentration, audit, traceability, comparability, and intervention checks per project.
- PMO Filtered Status Report: creates PMO reports filtered by project status and last status report date or narrative text.
- Monthly Project-Leader Status Writeback: prepares one status update per active project and report month, with Quick Create staging, project-manager verification, safety gates, and explicit save confirmation.
- Status API Max Layer: adds status history reads, duplicate checks, idempotency keys, delta exports, pagination, metadata discovery, permission probes, structured status payloads, validation, writeback queues, audit events, attachment plans, Dataverse error mapping, schema envelopes, and confirmation-gated `Xrm.WebApi.createRecord` plans.
- PMO Report Suite: generates 12 dedicated PMO management reports through the `pmo-report-suite` skill.
- PMO Word/Excel Export: writes polished filtered PMO reports as `.docx` and `.xlsx` files with executive callouts, KPI cards, filter scope, status legend, project spotlight, highlighted project rows, and PMO findings from live D365 API data or explicit offline snapshots.
- D365 API-First PMO Data: builds intelligence and monthly status plans directly from the logged-in Dynamics browser session through `Xrm.WebApi`; local JSON snapshots require explicit offline fallback mode.
- Decision Debt Analysis: measures open decisions, due dates, blocked projects, and decision-debt score.
- Project Truth Score: detects status contradictions such as red KPI with weak narrative, overdue finish, or missing mitigation.
- Sponsor Action Intelligence: turns steering agenda items into owner-specific sponsor actions.
- No-Surprise Forecast: flags likely escalation and silent risk signals before the next reporting cycle.
- AI Escalation Pack: prepares evidence-backed escalation packets with impact, options, and required decisions.
- Trust Contract: exposes evidence sources, completeness, safety rules, and confirmation requirements.
- Evidence Gap Detector: identifies missing proof needed to make a status report decision-ready.
- Executive Question Generator: creates steering questions for CIO/CEO review.
- Decision Option Scoring: ranks alternatives by risk reduction, time gain, and effort.
- Portfolio Constraint Radar: finds shared vendor, dependency, and owner constraints across projects.
- Commitment Tracker: turns sponsor actions and decisions into follow-up commitments.
- Risk Narrative Drift: detects recurring risks that were reworded instead of resolved.
- Escalation Readiness Score: checks whether problem, owner, decision, and options are escalation-ready.
- Governance Replay: reviews prior snapshots to show when warning signals first appeared.
- PMO Policy Simulator: tests governance policies against current project data.
- Cross-Project Dependency Intelligence: detects shared dependencies with active risk.
- Report Quality Benchmark: compares project status quality across the portfolio.
- Human Confirmation Analytics: measures accepted, edited, and rejected AI suggestions.

## Maximum USP Layer

`buildMaximumUspLayer(projects, options)` and `buildProjectIntelligence(projects, options).maximumUsps` expose 12 implemented USPs with target user, pain solved, concrete benefit, technical mechanism, required data, MVP implementation, trust controls, proof metric, feasibility, runtime signals, and USP score:

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

## 15 PMO USP Layer

`buildPmoUspLayer(projects, options)` and `buildProjectIntelligence(projects, options).pmoUsps` expose 15 PMO-operational USPs as implemented, advisory-only JSON objects. The layer includes `summary`, `usps`, `commandQueue`, `evidenceLedger`, and `dataGaps`.

The 15 PMO USPs are PMO Command Queue, Steering Committee Auto-Pack, Decision SLA Enforcement, Risk Aging Memory, PM Quality Coaching, Portfolio Bottleneck Detector, Governance Exception Radar, PMO Data Quality Score, Executive Attention Routing, Baseline Drift Watch, Writeback Audit Shield, PMO Evidence Ledger, No-Surprise Portfolio Forecast, Dependency Blast Radius, and PMO Board Pack Diff.

## Repository Layout

```text
.codex-plugin/plugin.json
.app.json
.mcp.json
skills/status-report/SKILL.md
docs/
examples/project-intelligence.sample.json
schemas/*.schema.json
.github/workflows/
plugins/tpg-scheduler-codex-plugin/
  .codex-plugin/plugin.json
  skills/status-report/SKILL.md
  scripts/statusbericht.js
  scripts/lib/project-intelligence.js
  scripts/*.test.js
```

## Quick Start

```powershell
cd plugins/tpg-scheduler-codex-plugin
npm test
npm run release:check
npm run release:manifest
npm run status-report:help
npm run status-report:dataverse
// In the authenticated Dynamics browser:
await TPGProjectAssist.retrieveProjectIntelligenceFromD365({ today: "YYYY-MM-DD" })
await TPGProjectAssist.retrieveMonthlyStatusPlanFromD365({ month: "YYYY-MM", statusText: "kv" })
```

## Documentation

- [Usage](docs/USAGE.md)
- [Installation](docs/INSTALLATION.md)
- [Validation](docs/VALIDATION.md)
- [Examples](docs/EXAMPLES.md)
- [JSON Schemas](docs/SCHEMA.md)
- [Dynamics End-to-End Runbook](docs/DYNAMICS_E2E_RUNBOOK.md)
- [Release Process](docs/RELEASE.md)
- [Public Repository Readiness](docs/PUBLICATION.md)
- [Privacy](docs/PRIVACY.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Contributing](CONTRIBUTING.md)
- [Security](SECURITY.md)
- [Changelog](CHANGELOG.md)
- [License](LICENSE)

## Safety Model

The plugin is designed as a decision-support and draft-preparation workflow. Project Safety Gates are advisory, evidence-backed checks that surface unsafe project states before status collection or staging. Generated risk lists, nudges, reports, and CRM field drafts are advisory until reviewed. CRM writes require visible user confirmation, and `Email Status Update` is treated as a separate risky action.

## Public Release Readiness

The repository includes schema contracts, documentation-only synthetic example output, CI validation, Dependabot configuration, CODEOWNERS, privacy guidance, and a tag-based release validation workflow. Productive CLI paths reject sample data; fixtures are reserved for automated tests and documentation only. Live Dynamics verification is intentionally documented as a manual smoke test because it depends on authenticated tenant access.
