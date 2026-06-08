# Architecture

## Overview

The plugin separates browser workflow guidance from deterministic project intelligence logic.

- The skill file describes how Codex should operate inside the in-app Browser.
- `scripts/statusbericht.js` exposes CLI commands, Dataverse helper snippets, URL builders, and public exports.
- `scripts/lib/project-intelligence.js` contains pure functions for risk, decision, governance, and AI/KI intelligence features.
- The project safety gate layer evaluates each project across eight advisory safety domains before status collection or CRM staging.
- The PMO control tower layer evaluates each project across 25 governance and portfolio-control routines for PMO review.
- `schemas/` defines stable JSON contracts for downstream PMO and executive tooling.
- `examples/` contains synthetic output for documentation and consumer tests only; productive CLI paths reject sample files.
- Tests validate normalization, CLI behavior, and project intelligence outputs without requiring Dynamics access.
- `scripts/validate-plugin.js` validates plugin metadata, documentation presence, skill naming, and write-safety wording.
- `assets/icon.svg` provides a lightweight public plugin asset for repository and marketplace use.

## Core Modules

### Skill

`plugins/tpg-scheduler-codex-plugin/skills/status-report/SKILL.md` is the operating guide for Codex. It defines safety gates, Dynamics navigation rules, Dataverse read preferences, and write-confirmation requirements.

### CLI And Browser Snippet

`scripts/statusbericht.js` provides:

- offline intelligence commands
- Dataverse browser-context snippet generation
- Dynamics URL builders
- status update draft helpers
- public exports for project intelligence functions
- plugin validation checks

### Project Intelligence

`scripts/lib/project-intelligence.js` provides evidence-backed helper functions, including:

- risk and status quality evaluation
- decision closure and SLA tracking
- governance exceptions
- risk trend and forecast intelligence
- escalation packs
- trust contracts
- safe writeback simulation
- evidence gap detection
- executive question generation
- decision option scoring
- portfolio constraint and dependency intelligence
- commitment tracking
- narrative drift detection
- governance replay and PMO policy simulation
- report quality benchmarking
- human confirmation analytics
- maximum project safety gates
- PMO control tower routines

## Safety Boundaries

The plugin does not directly automate CRM writes from Node.js. Browser-based CRM actions must remain confirmation-gated. Generated content is advisory until reviewed by the user.

## Project Safety Gates

`buildProjectSafetyGate(project, options)` returns a per-project advisory safety profile with `safetyScore`, `safetyLevel`, `managementAttention`, `writebackRisk`, gate evidence, required evidence, and recommended actions.

`buildProjectSafetyGateSuite(projects, options)` aggregates the per-project gates and is included in `buildProjectIntelligence(projects, options)` as `projectSafetyGates`.

The eight safety domains are data integrity, status truth, delivery risk, decision governance, financial/resource risk, escalation readiness, report quality, and writeback safety. The gates never save or block CRM automatically; they make risk visible before a human confirms any action.

## PMO Control Tower

`buildPmoProjectControls(project, projects, options)` returns 25 PMO checks for one project, including steering readiness, policy compliance, priority drift, baseline/risk/action/decision aging, owner and due-date accountability, concentration risks, audit completeness, evidence traceability, report comparability, heatmap consistency, and recommended PMO intervention.

`buildPmoControlTower(projects, options)` aggregates the project controls and is included in `buildProjectIntelligence(projects, options)` as `pmoControlTower`.

## Schema Layer

The schema layer documents output contracts without adding runtime dependencies. Validation checks parse each schema and assert critical contract anchors:

- Project intelligence includes `projectSafetyGates` and `pmoControlTower`.
- Safety gate projects expose safety score, level, management attention, writeback risk, gates, evidence, and actions.
- PMO control tower summaries declare exactly 25 checks per project.

Schemas are intentionally tolerant of additional properties so new advisory fields can be added without breaking consumers.

## Release And Governance

The public repository includes GitHub Actions CI, a tag-triggered release validation workflow, Dependabot configuration, CODEOWNERS, privacy guidance, and a Dynamics end-to-end smoke-test runbook. The live runbook remains manual because tenant access and CRM confirmation behavior cannot be validated from CI.

## Testing Strategy

The repository uses Node-based tests:

```powershell
cd plugins/tpg-scheduler-codex-plugin
npm test
```

The tests cover:

- status normalization
- status draft construction
- Dataverse URL/snippet generation
- project intelligence evidence rules
- AI/KI helper outputs
- maximum project safety gate outputs
- PMO control tower outputs
- CLI JSON/export behavior
- schema and documentation-only sample-output presence
- release, privacy, ownership, and dependency-management files
