# TPG-Scheduler-Codex-Plugin

TPG-Scheduler-Codex-Plugin is a Codex plugin for confirmation-gated Dynamics 365 TPG project status reporting. It helps project leaders and PMO stakeholders prepare status drafts, risk evidence, decision follow-ups, escalation packs, and executive portfolio summaries while keeping CRM writes under explicit human control.

## What It Does

- Opens and reviews active Dynamics 365 TPG project candidates through the Codex in-app Browser workflow.
- Verifies that the opened project record belongs to the configured project manager before status work continues.
- Normalizes short `kv` input to the configured unchanged-status phrase used in the target Dynamics environment.
- Builds project intelligence packs with evidence-backed risk, decision, PMO, and executive views.
- Stages status update drafts only after review and never saves, submits, sends, deletes, or changes CRM state without explicit confirmation.

## AI/KI Differentiators

- Maximum Project Safety Gates: evaluates every project across data integrity, status truth, delivery risk, governance, financial/resource risk, escalation readiness, report quality, and CRM writeback safety.
- PMO Control Tower: runs 25 PMO governance, accountability, aging, portfolio concentration, audit, traceability, comparability, and intervention checks per project.
- PMO Filtered Status Report: creates PMO reports filtered by project status and last status report date or narrative text.
- PMO Word/Excel Export: writes polished filtered PMO reports as `.docx` and `.xlsx` files with executive callouts, KPI cards, filter scope, status legend, project spotlight, highlighted project rows, and PMO findings from real project export data.
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
npm run status-report:help
node ./scripts/statusbericht.js --intelligence <real-project-export.json>
```

## Documentation

- [Usage](docs/USAGE.md)
- [Installation](docs/INSTALLATION.md)
- [Validation](docs/VALIDATION.md)
- [Examples](docs/EXAMPLES.md)
- [JSON Schemas](docs/SCHEMA.md)
- [Dynamics End-to-End Runbook](docs/DYNAMICS_E2E_RUNBOOK.md)
- [Release Process](docs/RELEASE.md)
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
