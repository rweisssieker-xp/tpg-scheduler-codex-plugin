# TPG-Scheduler-Codex-Plugin

TPG-Scheduler-Codex-Plugin is a Codex plugin for confirmation-gated Dynamics 365 TPG project status reporting. It helps project leaders and PMO stakeholders prepare status drafts, risk evidence, decision follow-ups, escalation packs, and executive portfolio summaries while keeping CRM writes under explicit human control.

## What It Does

- Opens and reviews active Dynamics 365 TPG project candidates through the Codex in-app Browser workflow.
- Verifies that the opened project record belongs to the configured project manager before status work continues.
- Normalizes short `kv` input to the configured unchanged-status phrase used in the target Dynamics environment.
- Builds project intelligence packs with evidence-backed risk, decision, PMO, and executive views.
- Stages status update drafts only after review and never saves, submits, sends, deletes, or changes CRM state without explicit confirmation.

## AI/KI Differentiators

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
npm run status-report:intelligence
```

## Documentation

- [Usage](docs/USAGE.md)
- [Installation](docs/INSTALLATION.md)
- [Validation](docs/VALIDATION.md)
- [Examples](docs/EXAMPLES.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Contributing](CONTRIBUTING.md)
- [Security](SECURITY.md)
- [Changelog](CHANGELOG.md)
- [License](LICENSE)

## Safety Model

The plugin is designed as a decision-support and draft-preparation workflow. Generated risk lists, nudges, reports, and CRM field drafts are advisory until reviewed. CRM writes require visible user confirmation, and `Email Status Update` is treated as a separate risky action.
