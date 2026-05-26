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
npm run statusbericht:help
npm run statusbericht:intelligence
```

## Documentation

- [Usage](docs/USAGE.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Contributing](CONTRIBUTING.md)
- [Security](SECURITY.md)
- [Changelog](CHANGELOG.md)
- [License](LICENSE)

## Safety Model

The plugin is designed as a decision-support and draft-preparation workflow. Generated risk lists, nudges, reports, and CRM field drafts are advisory until reviewed. CRM writes require visible user confirmation, and `Email Status Update` is treated as a separate risky action.
